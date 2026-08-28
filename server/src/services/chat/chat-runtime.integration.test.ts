import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type AppDeps, createApp } from '../../app.js'
import type { SseFrame } from '../../contracts/sse-trace.js'
import { validateSseTrace } from '../../contracts/sse-trace.js'
import { canonicalizeRfc8785, sha256Hex } from '../../security/crypto.js'
import {
  authedDelete,
  authedPost,
  bootstrapDevice,
  startTestPostgres,
  type TestPostgres,
} from '../../test-support/pg.js'
import { ModelCatalog } from '../models/model-catalog.js'
import type { ChatRuntimeTiming } from './chat-runtime.js'
import type { ChatProvider, ProviderChunk } from './provider-adapter.js'
import * as providerAdapter from './provider-adapter.js'

function chatApp(
  pg: TestPostgres,
  provider: ChatProvider,
  chatTiming?: Partial<ChatRuntimeTiming>,
) {
  const modelCatalog = ModelCatalog.load({
    env: { TEST_PROVIDER_KEY: 'test-key' },
    readFile: () =>
      JSON.stringify({
        models: [
          {
            id: 'test-model',
            displayName: 'Test model',
            baseURL: 'https://provider.invalid/v1',
            model: 'test-model-internal',
            apiKeyEnv: 'TEST_PROVIDER_KEY',
            enabled: true,
            isDefault: true,
            capabilities: { streaming: true, tools: true },
          },
        ],
      }),
  })
  return createApp({
    getConfig: () => ({ bootstrapSecret: 'cd'.repeat(32), modelCatalog }),
    getDb: () => pg.db,
    resolveSource: () => '203.0.113.44',
    chatProvider: provider,
    chatTiming,
  } as AppDeps & { chatProvider: ChatProvider })
}

function parseSse(body: string): SseFrame[] {
  return body
    .trim()
    .split('\n\n')
    .map((block) => {
      const lines = Object.fromEntries(
        block.split('\n').map((line) => {
          const separator = line.indexOf(':')
          return [line.slice(0, separator), line.slice(separator + 1).trimStart()]
        }),
      ) as Record<string, string>
      if (lines.event === undefined || lines.id === undefined || lines.data === undefined) {
        throw new Error('Malformed SSE fixture')
      }
      return { event: lines.event, eventId: lines.id, data: JSON.parse(lines.data) }
    })
}

describe('POST /api/v1/chat', () => {
  let pg: TestPostgres

  beforeAll(async () => {
    pg = await startTestPostgres()
  })

  beforeEach(async () => {
    await pg.sql.unsafe('delete from pending_confirmations')
    await pg.sql.unsafe('delete from conversations')
    await pg.sql.unsafe('delete from chat_request_receipts')
    await pg.sql.unsafe('delete from sync_action_receipts')
    await pg.sql.unsafe('delete from sync_changes')
    await pg.sql.unsafe('delete from settings')
    await pg.sql.unsafe('delete from device_tokens')
    await pg.sql.unsafe('delete from auth_config')
    const remaining = await pg.sql.unsafe('select count(*)::text as count from auth_config')
    if (remaining[0]?.count !== '0') throw new Error('chat fixture cleanup left auth_config rows')
  })

  afterAll(async () => {
    await pg.stop()
  })

  it('starts a generated SSE trace for an authenticated chat request', async () => {
    const app = chatApp(pg, {
      async *stream() {
        yield { type: 'text', text: 'hello' }
      },
    })
    const device = await bootstrapDevice(app)

    const response = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: '11111111-1111-4111-8111-111111111111',
      modelId: 'test-model',
      message: 'hello',
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    expect(validateSseTrace(parseSse(await response.text()))).toEqual({ success: true })
  })

  it('replays a completed receipt without calling the provider and persists one full turn', async () => {
    let calls = 0
    const app = chatApp(pg, {
      async *stream() {
        calls += 1
        yield { type: 'text', text: 'saved answer' }
      },
    })
    const device = await bootstrapDevice(app, 'replay-device')
    const request = {
      chatRequestId: '22222222-2222-4222-8222-222222222222',
      modelId: 'test-model',
      message: 'save this',
    }
    const initial = await authedPost(app, '/api/v1/chat', device.deviceToken, request)
    expect(validateSseTrace(parseSse(await initial.text()))).toEqual({ success: true })
    const replay = await authedPost(app, '/api/v1/chat', device.deviceToken, request)
    const frames = parseSse(await replay.text())
    expect(frames).toEqual([
      expect.objectContaining({
        event: 'start',
        data: expect.objectContaining({ replayed: true, resumed: false }),
      }),
      expect.objectContaining({ event: 'delta', data: { text: 'saved answer' } }),
      expect.objectContaining({ event: 'done' }),
    ])
    expect(calls).toBe(1)
    const conversations = await pg.sql.unsafe(
      'select messages from conversations where device_id = $1',
      [device.deviceId],
    )
    const conversationRow = conversations[0]
    expect(conversationRow).toBeDefined()
    expect(
      (conversationRow as unknown as { messages: { messages: unknown[] } }).messages.messages,
    ).toHaveLength(2)
  })

  it('passes the validated persisted conversation plus the current user turn to the next provider call', async () => {
    const received: unknown[] = []
    const app = chatApp(pg, {
      async *stream(request) {
        received.push((request as unknown as { messages?: unknown }).messages)
        yield { type: 'text', text: received.length === 1 ? 'first answer' : 'second answer' }
      },
    })
    const device = await bootstrapDevice(app, 'history-device')
    const first = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: '23232323-2323-4232-8232-232323232323',
      modelId: 'test-model',
      message: 'first question',
    })
    expect(validateSseTrace(parseSse(await first.text()))).toEqual({ success: true })
    const second = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: '24242424-2424-4242-8242-242424242424',
      modelId: 'test-model',
      message: 'second question',
    })
    expect(validateSseTrace(parseSse(await second.text()))).toEqual({ success: true })
    expect(received).toEqual([
      [{ role: 'user', content: 'first question' }],
      [
        { role: 'user', content: 'first question' },
        { role: 'assistant', content: 'first answer' },
        { role: 'user', content: 'second question' },
      ],
    ])
  })

  it('returns frozen JSON pre-stream errors for unavailable model and expired receipt', async () => {
    const app = chatApp(pg, { async *stream() {} })
    const device = await bootstrapDevice(app, 'error-device')
    const unavailable = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: '33333333-3333-4333-8333-333333333333',
      modelId: 'missing-model',
      message: 'hello',
    })
    expect(unavailable.status).toBe(422)
    expect((await unavailable.json()) as { errCode: string }).toMatchObject({
      errCode: 'MODEL_UNAVAILABLE',
    })

    const expiredRequest = {
      chatRequestId: '44444444-4444-4444-8444-444444444444',
      modelId: 'test-model',
      message: 'hello',
    }
    const requestHash = sha256Hex(
      canonicalizeRfc8785({ modelId: expiredRequest.modelId, message: expiredRequest.message }),
    )
    await pg.sql.unsafe(
      "insert into chat_request_receipts (device_id, chat_request_id, request_hash, status, retryable, lease_generation, attempt_count) values ($1, $2, $3, 'expired', false, 1, 1)",
      [device.deviceId, expiredRequest.chatRequestId, requestHash],
    )
    const expired = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      ...expiredRequest,
    })
    expect(expired.status).toBe(410)
    expect((await expired.json()) as { errCode: string }).toMatchObject({
      errCode: 'CHAT_REQUEST_EXPIRED',
    })

    const reused = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      ...expiredRequest,
      modelId: 'missing-model',
    })
    expect(reused.status).toBe(409)
    expect((await reused.json()) as { errCode: string }).toMatchObject({
      errCode: 'IDEMPOTENCY_KEY_REUSED',
    })
  })

  it('does not complete a receipt when the client cancels an established stream', async () => {
    let release: (() => void) | undefined
    let providerStarted: (() => void) | undefined
    let providerAborted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      providerStarted = resolve
    })
    const aborted = new Promise<void>((resolve) => {
      providerAborted = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const app = chatApp(pg, {
      async *stream({ abortSignal }) {
        providerStarted?.()
        await Promise.race([
          gate,
          new Promise<void>((resolve) => {
            abortSignal.addEventListener(
              'abort',
              () => {
                providerAborted?.()
                resolve()
              },
              { once: true },
            )
          }),
        ])
      },
    })
    const device = await bootstrapDevice(app, 'disconnect-device')
    const requestId = '45454545-4545-4545-8545-454545454545'
    const response = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: requestId,
      modelId: 'test-model',
      message: 'disconnect',
    })
    await started
    await response.body?.cancel()
    const didAbort = await Promise.race([
      aborted.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 20)),
    ])
    release?.()

    expect(didAbort).toBe(true)
    const receipts = await pg.sql.unsafe(
      'select status from chat_request_receipts where device_id = $1 and chat_request_id = $2',
      [device.deviceId, requestId],
    )
    expect(receipts[0]).toMatchObject({ status: 'running' })
    const conversations = await pg.sql.unsafe(
      'select count(*)::text as count from conversations where device_id = $1',
      [device.deviceId],
    )
    expect(conversations[0]?.count).toBe('0')
  })

  it('does not let an expired lease finish after its provider resumes', async () => {
    let release: (() => void) | undefined
    let providerStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      providerStarted = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const app = chatApp(pg, {
      async *stream() {
        providerStarted?.()
        yield { type: 'text', text: 'stale partial' }
        await gate
      },
    })
    const device = await bootstrapDevice(app, 'expired-lease-device')
    const requestId = '46464646-4646-4646-8646-464646464646'
    const response = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: requestId,
      modelId: 'test-model',
      message: 'expire this lease',
    })
    await started
    await pg.sql.unsafe(
      "update chat_request_receipts set heartbeat_at = now() - interval '2 seconds', lease_expires_at = now() - interval '1 second' where device_id = $1 and chat_request_id = $2",
      [device.deviceId, requestId],
    )
    release?.()
    const body = await response.text()

    expect(body).not.toContain('event: done')
    const receipt = await pg.sql.unsafe(
      'select status from chat_request_receipts where device_id = $1 and chat_request_id = $2',
      [device.deviceId, requestId],
    )
    expect(receipt[0]).toMatchObject({ status: 'running' })
    const conversations = await pg.sql.unsafe(
      'select count(*)::text as count from conversations where device_id = $1',
      [device.deviceId],
    )
    expect(conversations[0]?.count).toBe('0')
  })

  it('does not let a replaced lease owner mark its receipt failed or completed', async () => {
    let release: (() => void) | undefined
    let providerStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      providerStarted = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const app = chatApp(pg, {
      async *stream() {
        providerStarted?.()
        yield { type: 'text', text: 'old owner partial' }
        await gate
        throw new Error('old owner provider failure')
      },
    })
    const device = await bootstrapDevice(app, 'replaced-owner-device')
    const requestId = '48484848-4848-4848-8848-484848484848'
    const response = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: requestId,
      modelId: 'test-model',
      message: 'replace lease owner',
    })
    await started
    await pg.sql.unsafe(
      "update chat_request_receipts set lease_owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' where device_id = $1 and chat_request_id = $2",
      [device.deviceId, requestId],
    )
    release?.()
    const body = await response.text()

    expect(body).not.toContain('event: done')
    expect(body).not.toContain('event: error')
    const receipt = await pg.sql.unsafe(
      'select status, lease_owner from chat_request_receipts where device_id = $1 and chat_request_id = $2',
      [device.deviceId, requestId],
    )
    expect(receipt[0]).toMatchObject({
      status: 'running',
      lease_owner: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
    const conversations = await pg.sql.unsafe(
      'select count(*)::text as count from conversations where device_id = $1',
      [device.deviceId],
    )
    expect(conversations[0]?.count).toBe('0')
  })

  it('rolls back a conversation write when the client disconnects before receipt completion', async () => {
    let calls = 0
    const app = chatApp(pg, {
      async *stream() {
        calls += 1
        yield { type: 'text', text: calls === 1 ? 'first answer' : 'recovered answer' }
      },
    })
    const device = await bootstrapDevice(app, 'disconnect-complete-device')
    const request = {
      chatRequestId: '47474747-4747-4747-8747-474747474747',
      modelId: 'test-model',
      message: 'disconnect during completion',
    }
    await pg.sql.unsafe(
      'create function chat_test_delay_conversation() returns trigger language plpgsql as $$ begin perform pg_sleep(0.4); return new; end; $$',
    )
    await pg.sql.unsafe(
      'create trigger chat_test_delay_conversation_trigger after insert on conversations for each row execute function chat_test_delay_conversation()',
    )
    try {
      const response = await authedPost(app, '/api/v1/chat', device.deviceToken, request)
      await new Promise<void>((resolve) => setTimeout(resolve, 40))
      await response.body?.cancel()
      await new Promise<void>((resolve) => setTimeout(resolve, 450))
    } finally {
      await pg.sql.unsafe(
        'drop trigger if exists chat_test_delay_conversation_trigger on conversations',
      )
      await pg.sql.unsafe('drop function if exists chat_test_delay_conversation()')
    }

    const interruptedReceipt = await pg.sql.unsafe(
      'select status from chat_request_receipts where device_id = $1 and chat_request_id = $2',
      [device.deviceId, request.chatRequestId],
    )
    expect(interruptedReceipt[0]).toMatchObject({ status: 'running' })
    const interruptedConversation = await pg.sql.unsafe(
      'select count(*)::text as count from conversations where device_id = $1',
      [device.deviceId],
    )
    expect(interruptedConversation[0]?.count).toBe('0')

    await pg.sql.unsafe(
      "update chat_request_receipts set heartbeat_at = now() - interval '2 seconds', lease_expires_at = now() - interval '1 second' where device_id = $1 and chat_request_id = $2",
      [device.deviceId, request.chatRequestId],
    )
    const retry = await authedPost(app, '/api/v1/chat', device.deviceToken, request)
    expect(validateSseTrace(parseSse(await retry.text()))).toEqual({ success: true })
    const recovered = await pg.sql.unsafe(
      'select status from chat_request_receipts where device_id = $1 and chat_request_id = $2',
      [device.deviceId, request.chatRequestId],
    )
    expect(recovered[0]).toMatchObject({ status: 'completed' })
  })

  it('rolls back a conversation write when its lease expires during completion', async () => {
    let release: (() => void) | undefined
    let providerStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      providerStarted = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const app = chatApp(pg, {
      async *stream() {
        providerStarted?.()
        yield { type: 'text', text: 'answer after lease expiry' }
        await gate
      },
    })
    const device = await bootstrapDevice(app, 'completion-expiry-device')
    const request = {
      chatRequestId: '49494949-4949-4949-8949-494949494949',
      modelId: 'test-model',
      message: 'expire while writing',
    }
    await pg.sql.unsafe(
      'create function chat_test_expire_completion_lease() returns trigger language plpgsql as $$ begin perform pg_sleep(0.4); return new; end; $$',
    )
    await pg.sql.unsafe(
      'create trigger chat_test_expire_completion_lease_trigger after insert on conversations for each row execute function chat_test_expire_completion_lease()',
    )
    try {
      const response = await authedPost(app, '/api/v1/chat', device.deviceToken, request)
      await started
      await pg.sql.unsafe(
        "update chat_request_receipts set heartbeat_at = clock_timestamp(), lease_expires_at = clock_timestamp() + interval '150 milliseconds' where device_id = $1 and chat_request_id = $2",
        [device.deviceId, request.chatRequestId],
      )
      release?.()
      const body = await response.text()
      expect(body).not.toContain('event: done')
    } finally {
      await pg.sql.unsafe(
        'drop trigger if exists chat_test_expire_completion_lease_trigger on conversations',
      )
      await pg.sql.unsafe('drop function if exists chat_test_expire_completion_lease()')
    }

    const receipt = await pg.sql.unsafe(
      'select status, retryable, error_code from chat_request_receipts where device_id = $1 and chat_request_id = $2',
      [device.deviceId, request.chatRequestId],
    )
    expect(receipt[0]).toMatchObject({ status: 'running', retryable: false, error_code: null })
    const conversation = await pg.sql.unsafe(
      'select count(*)::text as count from conversations where device_id = $1',
      [device.deviceId],
    )
    expect(conversation[0]?.count).toBe('0')
  })

  it('rejects malformed stored conversation JSONB instead of persisting it as version 1', async () => {
    const app = chatApp(pg, {
      async *stream() {
        yield { type: 'text', text: 'new answer' }
      },
    })
    const device = await bootstrapDevice(app, 'invalid-history-device')
    await pg.sql.unsafe(
      'insert into conversations (device_id, messages, messages_schema_version) values ($1, \'{"messages":[{"unexpected":true}]}\'::jsonb, 1)',
      [device.deviceId],
    )
    const response = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: '12121212-1212-4212-8212-121212121212',
      modelId: 'test-model',
      message: 'validate history',
    })
    expect(response.status).toBe(500)
    expect((await response.json()) as { errCode: string }).toMatchObject({
      errCode: 'INTERNAL_ERROR',
    })
    const receipt = await pg.sql.unsafe(
      'select count(*)::text as count from chat_request_receipts where device_id = $1 and chat_request_id = $2',
      [device.deviceId, '12121212-1212-4212-8212-121212121212'],
    )
    expect(receipt[0]?.count).toBe('0')
  })

  it('turns provider failures into a valid PROVIDER_ERROR SSE terminal and retryable receipt', async () => {
    const app = chatApp(pg, {
      stream() {
        throw new Error('provider body must never escape')
      },
    })
    const device = await bootstrapDevice(app, 'provider-error-device')
    const requestId = '55555555-5555-4555-8555-555555555555'
    const response = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: requestId,
      modelId: 'test-model',
      message: 'fail',
    })
    const frames = parseSse(await response.text())
    expect(validateSseTrace(frames)).toEqual({ success: true })
    expect(frames.at(-1)).toMatchObject({ event: 'error', data: { errCode: 'PROVIDER_ERROR' } })
    const receipts = await pg.sql.unsafe(
      'select status, retryable, error_code from chat_request_receipts where device_id = $1 and chat_request_id = $2',
      [device.deviceId, requestId],
    )
    expect(receipts[0]).toMatchObject({
      status: 'failed',
      retryable: true,
      error_code: 'PROVIDER_ERROR',
    })
  })

  it('does not silently complete when the provider emits an AI SDK error stream part', async () => {
    const app = chatApp(pg, {
      async *stream() {
        yield { type: 'error' } as never
      },
    })
    const device = await bootstrapDevice(app, 'provider-error-part-device')
    const requestId = '51515151-5151-4515-8515-515151515151'

    const response = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: requestId,
      modelId: 'test-model',
      message: 'error chunk',
    })
    const frames = parseSse(await response.text())

    expect(frames.at(-1)).toMatchObject({ event: 'error', data: { errCode: 'PROVIDER_ERROR' } })
    const receipt = await pg.sql.unsafe(
      'select status, retryable, error_code from chat_request_receipts where device_id = $1 and chat_request_id = $2',
      [device.deviceId, requestId],
    )
    expect(receipt[0]).toMatchObject({
      status: 'failed',
      retryable: true,
      error_code: 'PROVIDER_ERROR',
    })
  })

  it('maps AI SDK error parts into the runtime provider error signal', async () => {
    const toProviderChunks = (
      providerAdapter as unknown as {
        toProviderChunks?: (parts: AsyncIterable<unknown>) => AsyncIterable<unknown>
      }
    ).toProviderChunks
    expect(toProviderChunks).toBeTypeOf('function')
    if (toProviderChunks === undefined) return

    async function* parts(): AsyncIterable<unknown> {
      yield { type: 'error', error: new Error('provider error must stay private') }
    }

    const chunks: unknown[] = []
    for await (const chunk of toProviderChunks(parts())) chunks.push(chunk)
    expect(chunks).toEqual([{ type: 'error' }])
  })

  it('maps AI SDK abort, tool-error, and non-stop terminal parts instead of silently ignoring them', async () => {
    const toProviderChunks = (
      providerAdapter as unknown as {
        toProviderChunks?: (parts: AsyncIterable<unknown>) => AsyncIterable<unknown>
      }
    ).toProviderChunks
    expect(toProviderChunks).toBeTypeOf('function')
    if (toProviderChunks === undefined) return

    async function* parts(): AsyncIterable<unknown> {
      yield { type: 'abort' }
      yield { type: 'tool-error', error: new Error('tool body must stay private') }
      yield { type: 'tool-input-delta', id: 'tool-1', delta: '{}' }
      yield { type: 'finish', finishReason: 'tool-calls' }
      yield { type: 'finish-step', finishReason: 'error' }
      yield { type: 'finish', finishReason: 'stop' }
    }

    const chunks: unknown[] = []
    for await (const chunk of toProviderChunks(parts())) chunks.push(chunk)
    expect(chunks).toEqual([
      { type: 'aborted' },
      { type: 'tool' },
      { type: 'tool' },
      { type: 'error' },
      { type: 'error' },
    ])
  })

  it('does not complete a receipt when the provider reports cancellation', async () => {
    const app = chatApp(pg, {
      async *stream() {
        yield { type: 'aborted' } as never
      },
    })
    const device = await bootstrapDevice(app, 'provider-abort-device')
    const requestId = '52525252-5252-4252-8252-525252525252'
    const response = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: requestId,
      modelId: 'test-model',
      message: 'provider cancelled',
    })
    const body = await response.text()

    expect(body).toContain('event: start')
    expect(body).not.toContain('event: done')
    expect(body).not.toContain('event: error')
    const receipt = await pg.sql.unsafe(
      'select status from chat_request_receipts where device_id = $1 and chat_request_id = $2',
      [device.deviceId, requestId],
    )
    expect(receipt[0]).toMatchObject({ status: 'running' })
    const conversations = await pg.sql.unsafe(
      'select count(*)::text as count from conversations where device_id = $1',
      [device.deviceId],
    )
    expect(conversations[0]?.count).toBe('0')
  })

  it('keeps one live receipt per device and lets a retryable failure take over its lease generation', async () => {
    let release: (() => void) | undefined
    let providerStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      providerStarted = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let calls = 0
    const app = chatApp(pg, {
      async *stream() {
        calls += 1
        if (calls === 1) {
          providerStarted?.()
          await gate
          yield { type: 'text', text: 'held' }
          return
        }
        if (calls === 2) throw new Error('retryable failure')
        yield { type: 'text', text: 'retry succeeded' }
      },
    })
    const device = await bootstrapDevice(app, 'single-live-device')
    const request = {
      chatRequestId: '56565656-5656-4656-8656-565656565656',
      modelId: 'test-model',
      message: 'only one live request',
    }
    const live = await authedPost(app, '/api/v1/chat', device.deviceToken, request)
    await started
    const inProgress = await authedPost(app, '/api/v1/chat', device.deviceToken, request)
    expect(inProgress.status).toBe(409)
    expect((await inProgress.json()) as { errCode: string }).toMatchObject({
      errCode: 'CHAT_IN_PROGRESS',
    })
    const busy = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: '57575757-5757-4757-8757-575757575757',
      modelId: 'test-model',
      message: 'second live request',
    })
    expect(busy.status).toBe(409)
    expect((await busy.json()) as { errCode: string }).toMatchObject({
      errCode: 'CHAT_DEVICE_BUSY',
    })
    release?.()
    expect(validateSseTrace(parseSse(await live.text()))).toEqual({ success: true })

    const failing = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: '58585858-5858-4858-8858-585858585858',
      modelId: 'test-model',
      message: 'retry this',
    })
    expect(parseSse(await failing.text()).at(-1)).toMatchObject({
      event: 'error',
      data: { errCode: 'PROVIDER_ERROR' },
    })
    const retryRequest = {
      chatRequestId: '58585858-5858-4858-8858-585858585858',
      modelId: 'test-model',
      message: 'retry this',
    }
    const retry = await authedPost(app, '/api/v1/chat', device.deviceToken, retryRequest)
    expect(validateSseTrace(parseSse(await retry.text()))).toEqual({ success: true })
    const receipt = await pg.sql.unsafe(
      'select status, lease_generation, attempt_count from chat_request_receipts where device_id = $1 and chat_request_id = $2',
      [device.deviceId, retryRequest.chatRequestId],
    )
    expect(receipt[0]).toMatchObject({
      status: 'completed',
      lease_generation: 2,
      attempt_count: 2,
    })
  })

  it('does not take over a retryable receipt while another request owns the device lease', async () => {
    let release: (() => void) | undefined
    let providerStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      providerStarted = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let calls = 0
    const app = chatApp(pg, {
      async *stream() {
        calls += 1
        if (calls === 1) {
          providerStarted?.()
          await gate
          yield { type: 'text', text: 'active answer' }
          return
        }
        yield { type: 'text', text: 'must not start while busy' }
      },
    })
    const device = await bootstrapDevice(app, 'expired-retry-busy-device')
    const expiredRequest = {
      chatRequestId: '59595959-5959-4959-8959-595959595959',
      modelId: 'test-model',
      message: 'retry while another request is active',
    }
    const expiredHash = sha256Hex(
      canonicalizeRfc8785({ modelId: expiredRequest.modelId, message: expiredRequest.message }),
    )
    const active = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: '60606060-6060-4060-8060-606060606060',
      modelId: 'test-model',
      message: 'active request',
    })
    await started

    await pg.sql.unsafe(
      "insert into chat_request_receipts (device_id, chat_request_id, request_hash, model_id, message, status, retryable, lease_generation, attempt_count, error_code) values ($1, $2, $3, $4, $5, 'failed', true, 1, 1, 'PROVIDER_ERROR')",
      [
        device.deviceId,
        expiredRequest.chatRequestId,
        expiredHash,
        expiredRequest.modelId,
        expiredRequest.message,
      ],
    )

    const retry = await authedPost(app, '/api/v1/chat', device.deviceToken, expiredRequest)
    expect(retry.status).toBe(409)
    expect((await retry.json()) as { errCode: string }).toMatchObject({
      errCode: 'CHAT_DEVICE_BUSY',
    })
    expect(calls).toBe(1)

    release?.()
    expect(validateSseTrace(parseSse(await active.text()))).toEqual({ success: true })
  })

  it('keeps a pending provider read across heartbeats so its first delayed delta is not lost', async () => {
    const app = chatApp(
      pg,
      {
        async *stream() {
          await new Promise<void>((resolve) => setTimeout(resolve, 15))
          yield { type: 'text', text: 'delayed delta' }
        },
      },
      { heartbeatMs: 5, idleMs: 100 },
    )
    const device = await bootstrapDevice(app, 'heartbeat-device')
    const response = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: 'abababab-abab-4bab-8bab-abababababab',
      modelId: 'test-model',
      message: 'wait for it',
    })
    const frames = parseSse(await response.text())
    expect(validateSseTrace(frames)).toEqual({ success: true })
    expect(frames).toContainEqual(
      expect.objectContaining({ event: 'delta', data: { text: 'delayed delta' } }),
    )
  })

  it('emits MODEL_TIMEOUT for an idle provider and supersedes an expired receipt when a new request wins', async () => {
    const timeoutApp = chatApp(
      pg,
      {
        async *stream({ abortSignal }) {
          await new Promise<void>((resolve) => {
            abortSignal.addEventListener('abort', () => resolve(), { once: true })
          })
        },
      },
      { idleMs: 5 },
    )
    const timeoutDevice = await bootstrapDevice(timeoutApp, 'timeout-device')
    const timeout = await authedPost(timeoutApp, '/api/v1/chat', timeoutDevice.deviceToken, {
      chatRequestId: '77777777-7777-4777-8777-777777777777',
      modelId: 'test-model',
      message: 'wait',
    })
    const timeoutFrames = parseSse(await timeout.text())
    expect(validateSseTrace(timeoutFrames)).toEqual({ success: true })
    expect(timeoutFrames.at(-1)).toMatchObject({
      event: 'error',
      data: { errCode: 'MODEL_TIMEOUT' },
    })

    await pg.sql.unsafe('delete from pending_confirmations')
    await pg.sql.unsafe('delete from conversations')
    await pg.sql.unsafe('delete from chat_request_receipts')
    await pg.sql.unsafe('delete from sync_action_receipts')
    await pg.sql.unsafe('delete from sync_changes')
    await pg.sql.unsafe('delete from settings')
    await pg.sql.unsafe('delete from device_tokens')
    await pg.sql.unsafe('delete from auth_config')

    const app = chatApp(pg, {
      async *stream() {
        yield { type: 'text', text: 'new answer' }
      },
    })
    const device = await bootstrapDevice(app, 'supersede-device')
    const oldRequest = {
      chatRequestId: '88888888-8888-4888-8888-888888888888',
      modelId: 'test-model',
      message: 'old request',
    }
    const oldHash = sha256Hex(
      canonicalizeRfc8785({ modelId: oldRequest.modelId, message: oldRequest.message }),
    )
    await pg.sql.unsafe(
      "insert into chat_request_receipts (device_id, chat_request_id, request_hash, model_id, message, status, retryable, lease_owner, lease_generation, lease_expires_at, heartbeat_at, attempt_count) values ($1, $2, $3, $4, $5, 'running', false, '99999999-9999-4999-8999-999999999999', 1, now() - interval '20 seconds', now() - interval '40 seconds', 1)",
      [device.deviceId, oldRequest.chatRequestId, oldHash, oldRequest.modelId, oldRequest.message],
    )
    const winner = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: '99999999-9999-4999-8999-000000000001',
      modelId: 'test-model',
      message: 'new request',
    })
    expect(validateSseTrace(parseSse(await winner.text()))).toEqual({ success: true })
    const superseded = await authedPost(app, '/api/v1/chat', device.deviceToken, oldRequest)
    expect(superseded.status).toBe(409)
    expect((await superseded.json()) as { errCode: string }).toMatchObject({
      errCode: 'CHAT_REQUEST_SUPERSEDED',
    })
  })

  it('uses the total chat duration limit even when the provider is not idle-expired', async () => {
    const app = chatApp(
      pg,
      {
        async *stream({ abortSignal }) {
          await new Promise<void>((resolve) => {
            abortSignal.addEventListener('abort', () => resolve(), { once: true })
          })
        },
      },
      { idleMs: 100, totalMs: 5 },
    )
    const device = await bootstrapDevice(app, 'total-timeout-device')
    const response = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: '78787878-7878-4787-8787-787878787878',
      modelId: 'test-model',
      message: 'time out in total',
    })
    expect(parseSse(await response.text()).at(-1)).toMatchObject({
      event: 'error',
      data: { errCode: 'MODEL_TIMEOUT' },
    })
  })

  it('closes a pending provider iterator after an idle timeout', async () => {
    let closeCalls = 0
    const app = chatApp(
      pg,
      {
        stream() {
          return {
            [Symbol.asyncIterator](): AsyncIterator<ProviderChunk> {
              return {
                next: () => new Promise<IteratorResult<ProviderChunk>>(() => {}),
                return: async () => {
                  closeCalls += 1
                  return { done: true, value: undefined as unknown as ProviderChunk }
                },
              }
            },
          }
        },
      },
      { idleMs: 5 },
    )
    const device = await bootstrapDevice(app, 'iterator-close-device')
    const response = await authedPost(app, '/api/v1/chat', device.deviceToken, {
      chatRequestId: '79797979-7979-4797-8797-797979797979',
      modelId: 'test-model',
      message: 'close the iterator',
    })

    expect(parseSse(await response.text()).at(-1)).toMatchObject({
      event: 'error',
      data: { errCode: 'MODEL_TIMEOUT' },
    })
    await Promise.resolve()
    expect(closeCalls).toBe(1)
  })

  it('keeps the latest twenty complete turns and expires older terminal receipts', async () => {
    const app = chatApp(pg, {
      async *stream() {
        yield { type: 'text', text: 'answer' }
      },
    })
    const device = await bootstrapDevice(app, 'retention-device')
    for (let index = 1; index <= 21; index += 1) {
      const suffix = String(index).padStart(12, '0')
      const response = await authedPost(app, '/api/v1/chat', device.deviceToken, {
        chatRequestId: `67676767-6767-4767-8767-${suffix}`,
        modelId: 'test-model',
        message: `turn ${index}`,
      })
      expect(response.status).toBe(200)
      await response.text()
    }
    const conversation = await pg.sql.unsafe(
      'select messages from conversations where device_id = $1',
      [device.deviceId],
    )
    expect(
      (conversation[0] as unknown as { messages: { messages: unknown[] } }).messages.messages,
    ).toHaveLength(40)
    const expired = await pg.sql.unsafe(
      "select count(*)::text as count from chat_request_receipts where device_id = $1 and status = 'expired' and model_id is null and message is null and final_response is null",
      [device.deviceId],
    )
    expect(expired[0]?.count).toBe('1')
  })

  it('fences a revoked active stream: it closes without UNAUTHORIZED SSE and without a conversation write', async () => {
    let release: (() => void) | undefined
    let providerStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      providerStarted = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const app = chatApp(pg, {
      async *stream({ abortSignal }) {
        providerStarted?.()
        yield { type: 'text', text: 'partial' }
        await gate
        if (!abortSignal.aborted) yield { type: 'text', text: 'must not persist' }
      },
    })
    const victim = await bootstrapDevice(app, 'victim-device')
    const registered = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyCode: victim.familyCode, deviceName: 'revoker-device' }),
    })
    const revoker = (await registered.json()) as {
      success: boolean
      data: { deviceId: string; deviceToken: string }
    }
    expect(revoker.success).toBe(true)
    const requestId = '66666666-6666-4666-8666-666666666666'
    const response = await authedPost(app, '/api/v1/chat', victim.deviceToken, {
      chatRequestId: requestId,
      modelId: 'test-model',
      message: 'race',
    })
    await started
    const revoked = await authedDelete(
      app,
      `/api/v1/auth/devices/${victim.deviceId}`,
      revoker.data.deviceToken,
    )
    expect(revoked.status).toBe(200)
    release?.()
    const body = await response.text()
    expect(body).toContain('event: start')
    expect(body).toContain('event: delta')
    expect(body).not.toContain('UNAUTHORIZED')
    expect(body).not.toContain('event: done')
    const conversation = await pg.sql.unsafe(
      'select count(*)::text as count from conversations where device_id = $1',
      [victim.deviceId],
    )
    expect(conversation[0]?.count).toBe('0')
    const receipt = await pg.sql.unsafe(
      'select status, retryable, error_code from chat_request_receipts where device_id = $1 and chat_request_id = $2',
      [victim.deviceId, requestId],
    )
    expect(receipt[0]).toMatchObject({
      status: 'failed',
      retryable: false,
      error_code: 'UNAUTHORIZED',
    })
  })
})
