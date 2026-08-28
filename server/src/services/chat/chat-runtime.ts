import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { ChatHistoryResponse, ChatRequest } from '../../contracts/generated/schemas.js'
import { validateVersionedJsonb } from '../../contracts/mappers/versioned-jsonb.js'
import { type SseFrame, validateSseTrace } from '../../contracts/sse-trace.js'
import type { Db } from '../../db/pool.js'
import { PublicError } from '../../errors.js'
import { canonicalizeRfc8785, sha256Hex } from '../../security/crypto.js'
import {
  type ConfiguredModel,
  type ModelCatalog,
  ModelCatalogError,
} from '../models/model-catalog.js'
import type { ChatProvider, ProviderChunk, ProviderMessage } from './provider-adapter.js'

const HEARTBEAT_MS = 10_000
const IDLE_MS = 60_000
const TOTAL_MS = 300_000

export interface ChatRuntimeTiming {
  heartbeatMs: number
  idleMs: number
  totalMs: number
}

type ReceiptRow = {
  request_hash: string
  status: 'running' | 'completed' | 'failed' | 'expired'
  retryable: boolean
  lease_generation: number
  lease_expires_at: Date | string | null
  final_response: string | null
  error_code: string | null
}

interface PreparedLive {
  kind: 'live'
  request: ChatRequest
  model: ConfiguredModel
  messages: readonly ProviderMessage[]
  owner: string
  generation: number
}

interface PreparedReplay {
  kind: 'replay'
  request: ChatRequest
  response: string
}

type PreparedRun = PreparedLive | PreparedReplay

interface LiveProviderState {
  iterator: AsyncIterator<ProviderChunk>
  pendingNext?: Promise<IteratorResult<ProviderChunk>>
  lastEventAt: number
  lastHeartbeatAt: number
  startedAt: number
}

type LiveProviderStep =
  | { kind: 'text'; text: string }
  | { kind: 'done' }
  | { kind: 'timeout' }
  | { kind: 'waiting' }
  | { kind: 'closed' }

class ProviderStreamFailure extends Error {}

class SseTrace {
  private readonly frames: SseFrame[] = []

  next(event: string, data: unknown): SseFrame {
    const frame = { event, eventId: String(this.frames.length + 1), data }
    this.frames.push(frame)
    return frame
  }

  finish(): void {
    const result = validateSseTrace(this.frames)
    if (!result.success) throw new Error(`invalid generated SSE trace: ${result.error}`)
  }
}

interface ChatRuntimeDeps {
  getDb(): Db
  getModelCatalog(): ModelCatalog
  provider: ChatProvider
  timing?: Partial<ChatRuntimeTiming>
}

type DbTransaction = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * Receipt/lease coordinator. Every business write locks its device-token row before
 * inspecting its receipt generation, fencing revocation against conversation writes.
 */
export class ChatRuntime {
  private readonly timing: ChatRuntimeTiming

  constructor(private readonly deps: ChatRuntimeDeps) {
    this.timing = {
      heartbeatMs: deps.timing?.heartbeatMs ?? HEARTBEAT_MS,
      idleMs: deps.timing?.idleMs ?? IDLE_MS,
      totalMs: deps.timing?.totalMs ?? TOTAL_MS,
    }
  }

  private resolveRequestedModel(modelId: string): ConfiguredModel {
    try {
      return this.deps.getModelCatalog().resolveRequested(modelId)
    } catch (error) {
      if (error instanceof ModelCatalogError) throw new PublicError('MODEL_UNAVAILABLE')
      throw error
    }
  }

  async prepare(request: ChatRequest, deviceId: string): Promise<PreparedRun> {
    const requestHash = sha256Hex(
      canonicalizeRfc8785({ modelId: request.modelId, message: request.message }),
    )
    const leaseOwner = randomUUID()

    return await this.deps
      .getDb()
      .transaction((tx) => this.prepareLocked(tx, request, deviceId, requestHash, leaseOwner))
  }

  private async prepareLocked(
    tx: DbTransaction,
    request: ChatRequest,
    deviceId: string,
    requestHash: string,
    leaseOwner: string,
  ): Promise<PreparedRun> {
    await this.assertActiveDevice(tx, deviceId)
    const existing = await this.lockReceipt(tx, deviceId, request.chatRequestId)
    if (existing !== undefined) {
      return await this.resumeReceipt(tx, existing, request, deviceId, requestHash, leaseOwner)
    }
    return await this.createReceipt(tx, request, deviceId, requestHash, leaseOwner)
  }

  private async assertActiveDevice(tx: DbTransaction, deviceId: string): Promise<void> {
    const tokenRows = (await tx.execute(
      sql`select id, revoked_at from device_tokens where id = ${deviceId}::uuid for update`,
    )) as unknown as Array<{ id: string; revoked_at: Date | null }>
    if (tokenRows[0] === undefined || tokenRows[0].revoked_at !== null) {
      throw new PublicError('UNAUTHORIZED')
    }
  }

  private async lockReceipt(
    tx: DbTransaction,
    deviceId: string,
    chatRequestId: string,
  ): Promise<ReceiptRow | undefined> {
    const rows = (await tx.execute(
      sql`select request_hash, status, retryable, lease_generation, lease_expires_at, final_response, error_code
          from chat_request_receipts
          where device_id = ${deviceId}::uuid and chat_request_id = ${chatRequestId}::uuid
          for update`,
    )) as unknown as ReceiptRow[]
    return rows[0]
  }

  /** A device may own only one non-expired running chat, including during retry takeover. */
  private async assertNoOtherLiveReceipt(
    tx: DbTransaction,
    deviceId: string,
    chatRequestId: string,
  ): Promise<void> {
    const rows = (await tx.execute(sql`
      select chat_request_id from chat_request_receipts
      where device_id = ${deviceId}::uuid and chat_request_id <> ${chatRequestId}::uuid
        and status = 'running' and lease_expires_at > clock_timestamp()
      for update
    `)) as unknown as Array<{ chat_request_id: string }>
    if (rows[0] !== undefined) throw new PublicError('CHAT_DEVICE_BUSY', { retryAfterSeconds: 1 })
  }

  private async resumeReceipt(
    tx: DbTransaction,
    existing: ReceiptRow,
    request: ChatRequest,
    deviceId: string,
    requestHash: string,
    leaseOwner: string,
  ): Promise<PreparedRun> {
    if (existing.request_hash !== requestHash) throw new PublicError('IDEMPOTENCY_KEY_REUSED')
    if (existing.status === 'completed') {
      return { kind: 'replay', request, response: existing.final_response ?? '' }
    }
    if (existing.status === 'expired') throw new PublicError('CHAT_REQUEST_EXPIRED')
    if (existing.status === 'running' && isLeaseActive(existing.lease_expires_at)) {
      throw new PublicError('CHAT_IN_PROGRESS', { retryAfterSeconds: 1 })
    }
    if (existing.status === 'failed' && !existing.retryable) {
      throw new PublicError('CHAT_REQUEST_SUPERSEDED')
    }

    await this.assertNoOtherLiveReceipt(tx, deviceId, request.chatRequestId)
    const model = this.resolveRequestedModel(request.modelId)
    const generation = existing.lease_generation + 1
    await tx.execute(sql`
      update chat_request_receipts
      set model_id = ${request.modelId}, message = ${request.message}, status = 'running', retryable = false,
          lease_owner = ${leaseOwner}::uuid, lease_generation = ${generation},
          lease_expires_at = now() + interval '30 seconds', heartbeat_at = now(),
          attempt_count = attempt_count + 1, tool_receipts = null, tool_receipts_schema_version = null,
          final_response = null, error_code = null, updated_at = now()
      where device_id = ${deviceId}::uuid and chat_request_id = ${request.chatRequestId}::uuid
    `)
    return await this.preparedLive(tx, request, deviceId, model, leaseOwner, generation)
  }

  private async createReceipt(
    tx: DbTransaction,
    request: ChatRequest,
    deviceId: string,
    requestHash: string,
    leaseOwner: string,
  ): Promise<PreparedLive> {
    await this.assertNoOtherLiveReceipt(tx, deviceId, request.chatRequestId)

    const model = this.resolveRequestedModel(request.modelId)
    await tx.execute(sql`
      update chat_request_receipts
      set status = 'failed', retryable = false, lease_owner = null, lease_expires_at = null,
          heartbeat_at = null, error_code = 'CHAT_REQUEST_SUPERSEDED', updated_at = now()
      where device_id = ${deviceId}::uuid and chat_request_id <> ${request.chatRequestId}::uuid
        and ((status = 'running' and lease_expires_at <= now()) or (status = 'failed' and retryable = true))
    `)
    await tx.execute(sql`
      insert into chat_request_receipts (
        device_id, chat_request_id, request_hash, model_id, message, status, retryable,
        lease_owner, lease_generation, lease_expires_at, heartbeat_at, attempt_count
      ) values (
        ${deviceId}::uuid, ${request.chatRequestId}::uuid, ${requestHash}, ${request.modelId},
        ${request.message}, 'running', false, ${leaseOwner}::uuid, 1,
        now() + interval '30 seconds', now(), 1
      )
    `)
    return await this.preparedLive(tx, request, deviceId, model, leaseOwner, 1)
  }

  private async preparedLive(
    tx: DbTransaction,
    request: ChatRequest,
    deviceId: string,
    model: ConfiguredModel,
    owner: string,
    generation: number,
  ): Promise<PreparedLive> {
    const messages = await this.loadProviderMessages(tx, deviceId, request)
    return { kind: 'live', request, model, messages, owner, generation }
  }

  /** Public iterable entry point; routes use prepare() first so pre-stream errors remain JSON. */
  async *run(
    request: ChatRequest,
    deviceId: string,
    requestId = 'unknown',
  ): AsyncIterable<SseFrame> {
    yield* this.stream(await this.prepare(request, deviceId), deviceId, requestId)
  }

  private async loadProviderMessages(
    tx: Pick<Db, 'execute'>,
    deviceId: string,
    request: ChatRequest,
  ): Promise<readonly ProviderMessage[]> {
    const conversationRows = (await tx.execute(
      sql`select messages, messages_schema_version from conversations where device_id = ${deviceId}::uuid for share`,
    )) as unknown as Array<{ messages: unknown; messages_schema_version: number }>
    const stored = conversationRows[0]
    const history =
      stored === undefined
        ? ({ messages: [] } as ChatHistoryResponse)
        : (validateVersionedJsonb(
            'conversation.messages',
            stored.messages_schema_version,
            stored.messages,
          ) as ChatHistoryResponse)
    return [
      ...history.messages.map(({ role, content }) => ({ role, content })),
      { role: 'user', content: request.message },
    ]
  }

  async *stream(
    prepared: PreparedRun,
    deviceId: string,
    requestId: string,
    clientAbortSignal?: AbortSignal,
  ): AsyncIterable<SseFrame> {
    const trace = new SseTrace()
    if (prepared.kind === 'replay') {
      yield trace.next('start', {
        chatRequestId: prepared.request.chatRequestId,
        replayed: true,
        resumed: false,
      })
      if (prepared.response !== '') yield trace.next('delta', { text: prepared.response })
      yield trace.next('done', { chatRequestId: prepared.request.chatRequestId })
      trace.finish()
      return
    }

    yield* this.streamLive(prepared, deviceId, requestId, trace, clientAbortSignal)
  }

  private async *streamLive(
    prepared: PreparedLive,
    deviceId: string,
    requestId: string,
    trace: SseTrace,
    clientAbortSignal?: AbortSignal,
  ): AsyncIterable<SseFrame> {
    const abortController = new AbortController()
    const abortForClient = (): void => abortController.abort()
    if (clientAbortSignal?.aborted) return
    clientAbortSignal?.addEventListener('abort', abortForClient, { once: true })
    let response = ''
    let state: LiveProviderState | undefined
    yield trace.next('start', {
      chatRequestId: prepared.request.chatRequestId,
      replayed: false,
      resumed: false,
    })

    try {
      state = this.createLiveProviderState(prepared, abortController.signal)
      stream: while (true) {
        const step = await this.nextLiveProviderStep(
          prepared,
          deviceId,
          state,
          abortController.signal,
        )
        switch (step.kind) {
          case 'text':
            response += step.text
            yield trace.next('delta', { text: step.text })
            continue
          case 'waiting':
            continue
          case 'done':
            break stream
          case 'closed':
            abortController.abort()
            return
          case 'timeout':
            abortController.abort()
            yield* this.persistError(prepared, deviceId, 'MODEL_TIMEOUT', requestId, trace)
            return
        }
      }
      if (abortController.signal.aborted) return
      if (!(await this.complete(prepared, deviceId, response, clientAbortSignal))) {
        abortController.abort()
        return
      }
      yield trace.next('done', { chatRequestId: prepared.request.chatRequestId })
      trace.finish()
    } catch (error) {
      abortController.abort()
      if (clientAbortSignal?.aborted) return
      const errorCode = error instanceof ProviderStreamFailure ? 'PROVIDER_ERROR' : 'INTERNAL_ERROR'
      yield* this.persistError(
        prepared,
        deviceId,
        errorCode,
        requestId,
        trace,
        errorCode === 'PROVIDER_ERROR',
      )
    } finally {
      clientAbortSignal?.removeEventListener('abort', abortForClient)
      this.closeProviderIterator(state)
    }
  }

  /** Iterator close is best-effort: an already pending provider read must not delay HTTP teardown. */
  private closeProviderIterator(state: LiveProviderState | undefined): void {
    const close = state?.iterator.return
    if (close === undefined || state === undefined) return
    try {
      void Promise.resolve(close.call(state.iterator)).catch(() => undefined)
    } catch {
      // Iterator cleanup is best-effort and must not mask the terminal stream result.
    }
  }

  private async *persistError(
    prepared: PreparedLive,
    deviceId: string,
    errorCode: 'MODEL_TIMEOUT' | 'PROVIDER_ERROR' | 'INTERNAL_ERROR',
    requestId: string,
    trace: SseTrace,
    retryable = true,
  ): AsyncIterable<SseFrame> {
    if (!(await this.fail(prepared, deviceId, errorCode, retryable))) return
    yield trace.next('error', errorData(errorCode, requestId))
    trace.finish()
  }

  private createLiveProviderState(
    prepared: PreparedLive,
    abortSignal: AbortSignal,
  ): LiveProviderState {
    try {
      const iterator = this.deps.provider
        .stream({
          model: prepared.model,
          message: prepared.request.message,
          messages: prepared.messages,
          abortSignal,
        })
        [Symbol.asyncIterator]()
      const now = Date.now()
      return { iterator, lastEventAt: now, lastHeartbeatAt: now, startedAt: now }
    } catch {
      throw new ProviderStreamFailure()
    }
  }

  private async nextLiveProviderStep(
    prepared: PreparedLive,
    deviceId: string,
    state: LiveProviderState,
    abortSignal: AbortSignal,
  ): Promise<LiveProviderStep> {
    if (abortSignal.aborted) return { kind: 'closed' }
    const waitMs = this.nextWaitMs(state)
    if (waitMs === undefined) return { kind: 'timeout' }
    state.pendingNext ??= state.iterator.next()
    void state.pendingNext.catch(() => undefined)
    let result: IteratorResult<ProviderChunk> | undefined
    try {
      result = await nextWithTimeout(state.pendingNext, waitMs, abortSignal)
    } catch {
      throw new ProviderStreamFailure()
    }
    if (abortSignal.aborted) return { kind: 'closed' }
    if (result === undefined) return await this.heartbeatStep(prepared, deviceId, state)
    state.pendingNext = undefined
    return await this.handleProviderResult(prepared, deviceId, state, result)
  }

  private nextWaitMs(state: LiveProviderState): number | undefined {
    const now = Date.now()
    const idleLeft = this.timing.idleMs - (now - state.lastEventAt)
    const totalLeft = this.timing.totalMs - (now - state.startedAt)
    if (idleLeft <= 0 || totalLeft <= 0) return undefined
    const heartbeatLeft = this.timing.heartbeatMs - (now - state.lastHeartbeatAt)
    return Math.max(1, Math.min(idleLeft, totalLeft, heartbeatLeft))
  }

  private async heartbeatStep(
    prepared: PreparedLive,
    deviceId: string,
    state: LiveProviderState,
  ): Promise<LiveProviderStep> {
    if (Date.now() - state.lastHeartbeatAt < this.timing.heartbeatMs) return { kind: 'waiting' }
    if (!(await this.heartbeat(prepared, deviceId))) return { kind: 'closed' }
    state.lastHeartbeatAt = Date.now()
    return { kind: 'waiting' }
  }

  private async handleProviderResult(
    prepared: PreparedLive,
    deviceId: string,
    state: LiveProviderState,
    result: IteratorResult<ProviderChunk>,
  ): Promise<LiveProviderStep> {
    if (result.done) return { kind: 'done' }
    if (result.value.type === 'aborted') return { kind: 'closed' }
    if (result.value.type === 'tool' || result.value.type === 'error') {
      throw new ProviderStreamFailure()
    }
    state.lastEventAt = Date.now()
    const heartbeat = await this.heartbeatStep(prepared, deviceId, state)
    if (heartbeat.kind === 'closed') return heartbeat
    return { kind: 'text', text: result.value.text }
  }

  private async heartbeat(prepared: PreparedLive, deviceId: string): Promise<boolean> {
    return await this.deps.getDb().transaction(async (tx) => {
      const token = (await tx.execute(
        sql`select revoked_at from device_tokens where id = ${deviceId}::uuid for update`,
      )) as unknown as Array<{ revoked_at: Date | null }>
      const receipt = (await tx.execute(sql`
        select status, lease_generation, lease_owner, lease_expires_at from chat_request_receipts
        where device_id = ${deviceId}::uuid and chat_request_id = ${prepared.request.chatRequestId}::uuid
        for update
      `)) as unknown as LeaseRow[]
      const holdsLease = receiptHoldsLease(receipt[0], prepared)
      if (token[0] === undefined || token[0].revoked_at !== null) {
        if (holdsLease) {
          await tx.execute(sql`
            update chat_request_receipts
            set status = 'failed', retryable = false, lease_owner = null, lease_expires_at = null,
                heartbeat_at = null, error_code = 'UNAUTHORIZED', updated_at = now()
            where device_id = ${deviceId}::uuid and chat_request_id = ${prepared.request.chatRequestId}::uuid
              and status = 'running' and lease_owner = ${prepared.owner}::uuid
              and lease_generation = ${prepared.generation} and lease_expires_at > clock_timestamp()
          `)
        }
        return false
      }
      if (!holdsLease) return false
      const updated = (await tx.execute(sql`
        update chat_request_receipts
        set heartbeat_at = now(), lease_expires_at = now() + interval '30 seconds', updated_at = now()
        where device_id = ${deviceId}::uuid and chat_request_id = ${prepared.request.chatRequestId}::uuid
          and status = 'running' and lease_owner = ${prepared.owner}::uuid
          and lease_generation = ${prepared.generation} and lease_expires_at > clock_timestamp()
        returning chat_request_id
      `)) as unknown as Array<{ chat_request_id: string }>
      return updated[0] !== undefined
    })
  }

  private async complete(
    prepared: PreparedLive,
    deviceId: string,
    response: string,
    clientAbortSignal?: AbortSignal,
  ): Promise<boolean> {
    if (clientAbortSignal?.aborted) return false
    try {
      return await this.deps.getDb().transaction(async (tx) => {
        const token = (await tx.execute(
          sql`select revoked_at from device_tokens where id = ${deviceId}::uuid for update`,
        )) as unknown as Array<{ revoked_at: Date | null }>
        const receipt = (await tx.execute(sql`
        select status, lease_generation, lease_owner, lease_expires_at from chat_request_receipts
        where device_id = ${deviceId}::uuid and chat_request_id = ${prepared.request.chatRequestId}::uuid
        for update
        `)) as unknown as LeaseRow[]
        const holdsLease = receiptHoldsLease(receipt[0], prepared)
        if (token[0] === undefined || token[0].revoked_at !== null) {
          if (holdsLease) {
            await tx.execute(sql`
            update chat_request_receipts
            set status = 'failed', retryable = false, lease_owner = null, lease_expires_at = null,
                heartbeat_at = null, error_code = 'UNAUTHORIZED', updated_at = now()
            where device_id = ${deviceId}::uuid and chat_request_id = ${prepared.request.chatRequestId}::uuid
              and status = 'running' and lease_owner = ${prepared.owner}::uuid
              and lease_generation = ${prepared.generation} and lease_expires_at > clock_timestamp()
          `)
          }
          return false
        }
        if (!holdsLease || clientAbortSignal?.aborted) return false

        const conversationRows = (await tx.execute(
          sql`select messages, messages_schema_version from conversations where device_id = ${deviceId}::uuid for update`,
        )) as unknown as Array<{ messages: unknown; messages_schema_version: number }>
        const stored = conversationRows[0]
        const history =
          stored === undefined
            ? ({ messages: [] } as ChatHistoryResponse)
            : (validateVersionedJsonb(
                'conversation.messages',
                stored.messages_schema_version,
                stored.messages,
              ) as ChatHistoryResponse)
        const createdAt = new Date().toISOString()
        const messages: ChatHistoryResponse = {
          messages: [
            ...history.messages,
            {
              role: 'user' as const,
              content: prepared.request.message,
              chatRequestId: prepared.request.chatRequestId,
              createdAt,
            },
            {
              role: 'assistant' as const,
              content: response,
              chatRequestId: prepared.request.chatRequestId,
              createdAt,
            },
          ].slice(-40),
        }
        validateVersionedJsonb('conversation.messages', 1, messages)
        if (clientAbortSignal?.aborted) return false
        await tx.execute(sql`
        insert into conversations (device_id, messages, messages_schema_version, updated_at)
        values (${deviceId}::uuid, ${JSON.stringify(messages)}::jsonb, 1, now())
        on conflict (device_id) do update
        set messages = excluded.messages, messages_schema_version = 1, updated_at = now()
      `)
        throwIfClientDisconnected(clientAbortSignal)
        const completedRows = (await tx.execute(sql`
        update chat_request_receipts
        set status = 'completed', retryable = false, lease_owner = null, lease_expires_at = null,
            heartbeat_at = null, final_response = ${response}, error_code = null, updated_at = now()
        where device_id = ${deviceId}::uuid and chat_request_id = ${prepared.request.chatRequestId}::uuid
          and status = 'running' and lease_owner = ${prepared.owner}::uuid
          and lease_generation = ${prepared.generation} and lease_expires_at > clock_timestamp()
        returning chat_request_id
      `)) as unknown as Array<{ chat_request_id: string }>
        if (completedRows[0] === undefined) throw new CompletionFencedError()
        throwIfClientDisconnected(clientAbortSignal)
        await tx.execute(sql`
        update chat_request_receipts
        set status = 'expired', retryable = false, lease_owner = null, lease_expires_at = null,
            heartbeat_at = null, model_id = null, message = null, tool_receipts = null,
            tool_receipts_schema_version = null, final_response = null, error_code = null, updated_at = now()
        where device_id = ${deviceId}::uuid and chat_request_id in (
          select chat_request_id from chat_request_receipts
          where device_id = ${deviceId}::uuid and status in ('completed', 'failed')
          order by updated_at desc offset 20
        )
      `)
        throwIfClientDisconnected(clientAbortSignal)
        return true
      })
    } catch (error) {
      if (error instanceof CompletionFencedError) return false
      throw error
    }
  }

  /** On revocation the receipt becomes terminal, but the established stream emits no UNAUTHORIZED frame. */
  private async fail(
    prepared: PreparedLive,
    deviceId: string,
    errorCode: 'UNAUTHORIZED' | 'MODEL_TIMEOUT' | 'PROVIDER_ERROR' | 'INTERNAL_ERROR',
    retryable: boolean,
  ): Promise<boolean> {
    return await this.deps.getDb().transaction(async (tx) => {
      const token = (await tx.execute(
        sql`select revoked_at from device_tokens where id = ${deviceId}::uuid for update`,
      )) as unknown as Array<{ revoked_at: Date | null }>
      const active = token[0] !== undefined && token[0].revoked_at === null
      const receipt = (await tx.execute(sql`
        select status, lease_generation, lease_owner, lease_expires_at from chat_request_receipts
        where device_id = ${deviceId}::uuid and chat_request_id = ${prepared.request.chatRequestId}::uuid
        for update
      `)) as unknown as LeaseRow[]
      if (!receiptHoldsLease(receipt[0], prepared)) return false
      const failedRows = (await tx.execute(sql`
        update chat_request_receipts
        set status = 'failed', retryable = ${active ? retryable : false}, lease_owner = null,
            lease_expires_at = null, heartbeat_at = null,
            error_code = ${active ? errorCode : 'UNAUTHORIZED'}, updated_at = now()
        where device_id = ${deviceId}::uuid and chat_request_id = ${prepared.request.chatRequestId}::uuid
          and status = 'running' and lease_owner = ${prepared.owner}::uuid
          and lease_generation = ${prepared.generation} and lease_expires_at > clock_timestamp()
        returning chat_request_id
      `)) as unknown as Array<{ chat_request_id: string }>
      return active && failedRows[0] !== undefined
    })
  }
}

function isLeaseActive(expiresAt: Date | string | null): boolean {
  if (expiresAt === null) return false
  const expiresAtMs = typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt.getTime()
  return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now()
}

type LeaseRow = {
  status: string
  lease_generation: number
  lease_owner: string | null
  lease_expires_at: Date | string | null
}

class CompletionFencedError extends Error {}

function throwIfClientDisconnected(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new CompletionFencedError()
}

function receiptHoldsLease(receipt: LeaseRow | undefined, prepared: PreparedLive): boolean {
  return (
    receipt?.status === 'running' &&
    receipt.lease_generation === prepared.generation &&
    receipt.lease_owner === prepared.owner &&
    isLeaseActive(receipt.lease_expires_at)
  )
}

function errorData(
  errorCode: 'MODEL_TIMEOUT' | 'PROVIDER_ERROR' | 'INTERNAL_ERROR',
  requestId: string,
) {
  return {
    errCode: errorCode,
    errMessage:
      errorCode === 'MODEL_TIMEOUT'
        ? 'Model request timed out'
        : errorCode === 'PROVIDER_ERROR'
          ? 'Model provider failed'
          : 'Internal server error',
    retryable: errorCode !== 'INTERNAL_ERROR',
    requestId,
  }
}

async function nextWithTimeout<T>(
  next: Promise<IteratorResult<T>>,
  timeoutMs: number,
  abortSignal?: AbortSignal,
): Promise<IteratorResult<T> | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let abortListener: (() => void) | undefined
  if (abortSignal?.aborted) return undefined
  try {
    const outcomes: Array<Promise<IteratorResult<T> | undefined>> = [
      next,
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), timeoutMs)
      }),
    ]
    if (abortSignal !== undefined) {
      outcomes.push(
        new Promise<undefined>((resolve) => {
          abortListener = () => resolve(undefined)
          abortSignal.addEventListener('abort', abortListener, { once: true })
        }),
      )
    }
    return await Promise.race(outcomes)
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    if (abortListener !== undefined) abortSignal?.removeEventListener('abort', abortListener)
  }
}
