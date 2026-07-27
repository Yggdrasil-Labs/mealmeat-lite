/**
 * SSE Trace 校验
 *
 * 验证 SSE 事件序列的正确性：
 * - start 必须是第一个事件
 * - done 或 error 必须是最后一个事件 (terminal)
 * - eventId 必须单调递增
 * - tool lifecycle: running -> completed/failed
 * - confirmation-required 的 token 规则
 */

import { sseEventMap } from './generated/catalogs.js'
import type { TraceValidationResult } from './types.js'

export interface SseFrame {
  event: string
  id: string
  data: unknown
}

type ToolState = 'running' | 'completed' | 'failed'

const fail = (error: string): TraceValidationResult => ({ success: false, error })
const ok: TraceValidationResult = { success: true }

/** 校验首事件是 start */
function validateFirstEvent(frames: readonly SseFrame[]): TraceValidationResult | null {
  const first = frames[0] as SseFrame
  const def = sseEventMap.get(first.event)
  if (!def?.isStart) return fail(`First event must be start, got ${first.event}`)
  return null
}

/** 校验末事件是 terminal */
function validateLastEvent(frames: readonly SseFrame[]): TraceValidationResult | null {
  const last = frames[frames.length - 1] as SseFrame
  const def = sseEventMap.get(last.event)
  if (!def?.isTerminal) return fail(`Last event must be terminal, got ${last.event}`)
  return null
}

/** 校验 eventId 单调递增 */
function validateEventIdMonotonic(frames: readonly SseFrame[]): TraceValidationResult | null {
  let lastId = 0
  for (const frame of frames) {
    const currentId = Number.parseInt(frame.id, 10)
    if (Number.isNaN(currentId)) return fail(`Invalid eventId: ${frame.id}`)
    if (currentId <= lastId) {
      return fail(`EventId not monotonically increasing: ${currentId} <= ${lastId}`)
    }
    lastId = currentId
  }
  return null
}

/** 处理单个 tool-status 帧 */
function processToolStatus(
  toolCallId: string,
  status: string,
  states: Map<string, ToolState>,
): TraceValidationResult | null {
  const current = states.get(toolCallId)

  if (status === 'running') {
    if (current) return fail(`Tool ${toolCallId} lifecycle error: running after ${current}`)
    states.set(toolCallId, 'running')
    return null
  }

  if (status === 'completed' || status === 'failed') {
    if (current !== 'running') {
      return fail(`Tool ${toolCallId} lifecycle error: ${status} without running first`)
    }
    states.set(toolCallId, status)
  }
  return null
}

/** 校验 tool lifecycle */
function validateToolLifecycle(frames: readonly SseFrame[]): TraceValidationResult | null {
  const states = new Map<string, ToolState>()

  for (const frame of frames) {
    if (frame.event !== 'tool-status') continue
    const data = frame.data as { toolCallId?: string; status?: string }
    if (!data.toolCallId || !data.status) continue

    const error = processToolStatus(data.toolCallId, data.status, states)
    if (error) return error
  }
  return null
}

/** 非 pending 状态列表 */
const NON_PENDING_STATES = new Set(['expired', 'superseded', 'consumed'])

/** 校验单个 confirmation frame 的 token 规则 */
function validateSingleConfirmationToken(
  state: string,
  hasToken: boolean,
): TraceValidationResult | null {
  if (state === 'pending' && !hasToken) {
    return fail('confirmation-required with state=pending must have confirmationToken')
  }
  if (NON_PENDING_STATES.has(state) && hasToken) {
    return fail(`confirmation-required with state=${state} must not have confirmationToken`)
  }
  return null
}

/**
 * 校验 confirmation-required 事件的 token 规则
 *
 * 根据 Design § "SSE 事件协议" 和不变量 CONFIRMATION_STATE_FIELDS_MATCH：
 * - 当确认状态为 pending 时必须携带 confirmationToken
 * - 当状态为 expired、superseded 或 consumed 时禁止携带 confirmationToken
 */
function validateConfirmationTokens(frames: readonly SseFrame[]): TraceValidationResult | null {
  for (const frame of frames) {
    if (frame.event !== 'confirmation-required') continue

    const data = frame.data as { state?: string; confirmationToken?: string }
    if (!data.state) continue

    const hasToken = data.confirmationToken !== undefined && data.confirmationToken !== null
    const error = validateSingleConfirmationToken(data.state, hasToken)
    if (error) return error
  }
  return null
}

/** 校验 SSE trace */
export function validateSseTrace(frames: readonly SseFrame[]): TraceValidationResult {
  if (frames.length === 0) return fail('Empty trace')

  return (
    validateFirstEvent(frames) ||
    validateLastEvent(frames) ||
    validateEventIdMonotonic(frames) ||
    validateToolLifecycle(frames) ||
    validateConfirmationTokens(frames) ||
    ok
  )
}

// Re-export types
export type { TraceValidationResult } from './types.js'
