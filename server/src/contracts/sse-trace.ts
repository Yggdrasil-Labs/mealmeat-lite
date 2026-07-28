/**
 * SSE Trace 校验
 *
 * 所有事件、转移和 data 规则均来自生成的协议目录；此处只解释目录，
 * 不复制任何事件名、状态词或字段名。
 */

import { errorMap, sseEventMap } from './generated/catalogs.js'
import type { PublicSchemaId } from './generated/schemas.js'
import type { SseEventDescriptor, TraceValidationResult } from './types.js'
import { validateContract } from './validation.js'

export interface SseFrame {
  event: string
  eventId: string
  data: unknown
}

type ToolLifecycleState = 'started' | 'terminal'

interface TraceState {
  previous?: SseEventDescriptor
  previousEventId: bigint
  startCount: number
  terminalCount: number
  toolStates: Map<string, ToolLifecycleState>
}

const fail = (error: string): TraceValidationResult => ({ success: false, error })
const ok: TraceValidationResult = { success: true }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requiredString(
  data: unknown,
  field: string,
  context: string,
): string | TraceValidationResult {
  if (!isRecord(data) || typeof data[field] !== 'string' || data[field].length === 0) {
    return fail(`${context} must contain a non-empty ${field}`)
  }
  return data[field]
}

function validateMutuallyExclusiveFields(
  fields: readonly string[] | undefined,
  data: unknown,
): TraceValidationResult | null {
  if (!fields || fields.length < 2 || !isRecord(data)) return null

  if (fields.every((field) => data[field] === true)) {
    return fail(`${fields.join(' and ')} must not all be true`)
  }
  return null
}

function validateToolLifecycle(
  rule: {
    idField: string
    statusField: string
    startedStatus: string
    terminalStatuses: readonly string[]
  },
  data: unknown,
  states: Map<string, ToolLifecycleState>,
): TraceValidationResult | null {
  const toolCallId = requiredString(data, rule.idField, 'tool lifecycle')
  if (typeof toolCallId !== 'string') return toolCallId
  const status = requiredString(data, rule.statusField, 'tool lifecycle')
  if (typeof status !== 'string') return status

  const current = states.get(toolCallId)
  if (status === rule.startedStatus) {
    if (current) {
      return fail(`Tool ${toolCallId} lifecycle error: ${rule.startedStatus} after ${current}`)
    }
    states.set(toolCallId, 'started')
    return null
  }

  if (rule.terminalStatuses.includes(status)) {
    if (current !== 'started') {
      return fail(
        `Tool ${toolCallId} lifecycle error: ${status} without ${rule.startedStatus} first`,
      )
    }
    states.set(toolCallId, 'terminal')
    return null
  }

  return fail(`Tool ${toolCallId} lifecycle error: unsupported status ${status}`)
}

function validateConfirmationToken(
  rule: {
    stateField: string
    tokenField: string
    tokenRequiredState: string
    tokenForbiddenStates: readonly string[]
  },
  data: unknown,
): TraceValidationResult | null {
  const state = requiredString(data, rule.stateField, 'confirmation-required')
  if (typeof state !== 'string') return state
  const record = data as Record<string, unknown>
  const hasToken = Object.hasOwn(record, rule.tokenField) && record[rule.tokenField] !== null

  if (state === rule.tokenRequiredState && !hasToken) {
    return fail(`confirmation-required with state=${state} must have ${rule.tokenField}`)
  }
  if (rule.tokenForbiddenStates.includes(state) && hasToken) {
    return fail(`confirmation-required with state=${state} must not have ${rule.tokenField}`)
  }
  return null
}

/**
 * error frame 的 schema 只描述其 JSON 形状；错误码可用通道和 retryable
 * 仍必须由生成的公共错误目录裁决。字段名同样来自 SSE 事件规则，避免在
 * interpreter 中复制 wire 名称。
 */
function validateErrorCatalog(
  rule: {
    errCodeField: string
    retryableField: string
    requestIdField: string
  },
  data: unknown,
): TraceValidationResult | null {
  const errCode = requiredString(data, rule.errCodeField, 'SSE error')
  if (typeof errCode !== 'string') return errCode
  const requestId = requiredString(data, rule.requestIdField, 'SSE error')
  if (typeof requestId !== 'string') return requestId
  if (!isRecord(data) || typeof data[rule.retryableField] !== 'boolean') {
    return fail(`SSE error must contain boolean ${rule.retryableField}`)
  }

  const definition = errorMap.get(errCode)
  if (!definition) return fail(`Unknown error code: ${errCode}`)
  if (!definition.channels.includes('sse')) {
    return fail(`Error ${errCode} not supported on sse channel`)
  }
  if (definition.retryable !== data[rule.retryableField]) {
    return fail(
      `retryable mismatch: expected ${definition.retryable} for ${errCode}, got ${data[rule.retryableField]}`,
    )
  }
  return null
}

function validateFrameSequence(
  index: number,
  frame: SseFrame,
  definition: SseEventDescriptor,
  state: TraceState,
): TraceValidationResult | null {
  if (!/^[1-9][0-9]*$/.test(frame.eventId)) return fail(`Invalid eventId: ${frame.eventId}`)

  const currentEventId = BigInt(frame.eventId)
  if (index === 0 && currentEventId !== 1n) {
    return fail(`First eventId must be 1, got ${frame.eventId}`)
  }
  if (currentEventId <= state.previousEventId) {
    return fail(`EventId not monotonically increasing: ${frame.eventId}`)
  }
  state.previousEventId = currentEventId

  if (index === 0 && !definition.isStart) {
    return fail(`First event must be start, got ${frame.event}`)
  }
  if (definition.isStart) {
    state.startCount += 1
    if (state.startCount !== 1 || index !== 0) {
      return fail('start must occur exactly once and be the first event')
    }
  }
  if (state.previous && !state.previous.nextEvents.includes(definition.event)) {
    return fail(`Event ${frame.event} is not allowed after ${state.previous.event}`)
  }
  if (state.terminalCount > 0) return fail(`Event ${frame.event} appears after terminal event`)
  return null
}

function validateFrameData(
  frame: SseFrame,
  definition: SseEventDescriptor,
  state: TraceState,
): TraceValidationResult | null {
  const mutuallyExclusiveError = validateMutuallyExclusiveFields(
    definition.mutuallyExclusiveDataFields,
    frame.data,
  )
  if (mutuallyExclusiveError) return mutuallyExclusiveError

  if (definition.toolLifecycle) {
    const lifecycleError = validateToolLifecycle(
      definition.toolLifecycle,
      frame.data,
      state.toolStates,
    )
    if (lifecycleError) return lifecycleError
  }
  if (definition.confirmationToken) {
    const confirmationError = validateConfirmationToken(definition.confirmationToken, frame.data)
    if (confirmationError) return confirmationError
  }

  const dataResult = validateContract(definition.schemaId as PublicSchemaId, frame.data)
  if (!dataResult.success) return fail(`Invalid data for ${frame.event}: ${dataResult.error}`)

  if (definition.errorCatalog) {
    const errorCatalogError = validateErrorCatalog(definition.errorCatalog, frame.data)
    if (errorCatalogError) return errorCatalogError
  }
  return null
}

function validateTerminalPosition(
  frames: readonly SseFrame[],
  index: number,
  frame: SseFrame,
  definition: SseEventDescriptor,
  state: TraceState,
): TraceValidationResult | null {
  if (!definition.isTerminal) return null

  state.terminalCount += 1
  if (index !== frames.length - 1) return fail(`Terminal event ${frame.event} must be last`)
  return null
}

function validateTraceCompletion(state: TraceState): TraceValidationResult {
  if (state.startCount !== 1) return fail('Trace must contain exactly one start event')
  if (state.terminalCount !== 1) return fail('Trace must contain exactly one terminal event')
  const unclosedToolIds = Array.from(state.toolStates.entries())
    .filter(([, state]) => state === 'started')
    .map(([toolCallId]) => toolCallId)
  if (unclosedToolIds.length > 0) {
    return fail(`Unclosed tool lifecycle: ${unclosedToolIds.join(', ')}`)
  }
  return ok
}

/** 校验 SSE trace。 */
export function validateSseTrace(frames: readonly SseFrame[]): TraceValidationResult {
  if (frames.length === 0) return fail('Empty trace')

  const state: TraceState = {
    previousEventId: 0n,
    startCount: 0,
    terminalCount: 0,
    toolStates: new Map(),
  }
  for (const [index, frame] of frames.entries()) {
    const definition = sseEventMap.get(frame.event)
    if (!definition) return fail(`Unknown SSE event: ${frame.event}`)

    const sequenceError = validateFrameSequence(index, frame, definition, state)
    if (sequenceError) return sequenceError
    const dataError = validateFrameData(frame, definition, state)
    if (dataError) return dataError
    const terminalError = validateTerminalPosition(frames, index, frame, definition, state)
    if (terminalError) return terminalError
    state.previous = definition
  }
  return validateTraceCompletion(state)
}

export type { TraceValidationResult } from './types.js'
