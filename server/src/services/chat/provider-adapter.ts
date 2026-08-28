import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import type { ConfiguredModel } from '../models/model-catalog.js'

export type ProviderChunk =
  | { type: 'text'; text: string }
  | { type: 'tool' }
  | { type: 'error' }
  | { type: 'aborted' }

export interface ProviderMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ProviderStreamRequest {
  model: ConfiguredModel
  message: string
  messages: readonly ProviderMessage[]
  abortSignal: AbortSignal
}

/** Provider edge kept narrow so integration tests never need a networked model. */
export interface ChatProvider {
  stream(request: ProviderStreamRequest): AsyncIterable<ProviderChunk>
}

/** Maps AI SDK stream parts into the small, provider-neutral runtime contract. */
export async function* toProviderChunks(
  parts: AsyncIterable<unknown>,
): AsyncIterable<ProviderChunk> {
  for await (const part of parts) {
    const chunk = toProviderChunk(part)
    if (chunk !== undefined) yield chunk
  }
}

/**
 * OpenAI-compatible adapter for the pinned AI SDK.
 * `chat()` deliberately selects Chat Completions for custom compatible base URLs.
 */
export class OpenAiCompatibleProvider implements ChatProvider {
  async *stream(request: ProviderStreamRequest): AsyncIterable<ProviderChunk> {
    const provider = createOpenAI({
      baseURL: request.model.baseURL,
      apiKey: request.model.apiKey,
    })
    const result = streamText({
      model: provider.chat(request.model.model),
      messages: [...request.messages],
      abortSignal: request.abortSignal,
      maxRetries: 0,
      timeout: { chunkMs: 60_000, totalMs: 300_000 },
    })

    yield* toProviderChunks(result.fullStream)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function toProviderChunk(part: unknown): ProviderChunk | undefined {
  if (!isRecord(part) || typeof part.type !== 'string') return undefined
  if (part.type === 'text-delta' && typeof part.text === 'string') {
    return { type: 'text', text: part.text }
  }
  if (part.type === 'abort') return { type: 'aborted' }
  if (part.type === 'tool-call' || part.type.startsWith('tool-')) return { type: 'tool' }
  if (part.type === 'error') return { type: 'error' }
  if ((part.type === 'finish' || part.type === 'finish-step') && part.finishReason !== 'stop') {
    return { type: 'error' }
  }
  return undefined
}
