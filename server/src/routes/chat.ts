import { Hono } from 'hono'
import type { ChatRequest } from '../contracts/generated/schemas.js'
import { getDevice } from '../middleware/device-auth.js'
import type { ChatRuntime } from '../services/chat/chat-runtime.js'
import { ajvValidator } from '../utils/validation.js'

export function createChatRoutes(deps: {
  chat: ChatRuntime
  deviceAuth: ReturnType<typeof import('../middleware/device-auth.js').createDeviceAuth>
}): Hono {
  const routes = new Hono()
  routes.use('*', deps.deviceAuth)
  routes.post(
    '/',
    ajvValidator('json', { file: 'chat.schema.json', defPath: '/$defs/ChatRequest' }),
    async (c) => {
      const request = c.get('json') as ChatRequest
      const prepared = await deps.chat.prepare(request, getDevice(c).id)
      const encoder = new TextEncoder()
      const clientAbort = new AbortController()
      const requestAbort = c.req.raw.signal
      const abortForRequest = (): void => clientAbort.abort()
      if (requestAbort.aborted) clientAbort.abort()
      else requestAbort.addEventListener('abort', abortForRequest, { once: true })
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const frame of deps.chat.stream(
              prepared,
              getDevice(c).id,
              c.get('requestId'),
              clientAbort.signal,
            )) {
              controller.enqueue(
                encoder.encode(
                  `id: ${frame.eventId}\nevent: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`,
                ),
              )
            }
            if (!clientAbort.signal.aborted) controller.close()
          } catch {
            // The HTTP status is committed once this body exists. Runtime-owned failures
            // already use a terminal SSE frame; unknown transport failures close safely.
            if (!clientAbort.signal.aborted) controller.close()
          } finally {
            requestAbort.removeEventListener('abort', abortForRequest)
          }
        },
        cancel() {
          clientAbort.abort()
        },
      })
      return c.body(stream, 200, {
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream; charset=utf-8',
      })
    },
  )
  return routes
}
