/**
 * 错误目录
 *
 * 从生成的协议目录解析错误定义，校验错误 tuple
 */

import { errorMap } from './generated/catalogs.js'
import type { ContractValidationResult, PublicErrorDefinition, RetryAfterPolicy } from './types.js'
import { validateContract } from './validation.js'

/**
 * 公开错误码类型
 */
export type PublicErrorCode = PublicErrorDefinition['errCode']

/**
 * 解析错误码定义
 */
export function resolveErrorDefinition(errCode: PublicErrorCode): PublicErrorDefinition {
  const def = errorMap.get(errCode)
  if (!def) {
    throw new Error(`Unknown error code: ${errCode}`)
  }
  return def
}

/**
 * 错误 envelope 结构
 */
export interface PublicErrorEnvelope {
  success: false
  errCode: string
  errMessage: string
  requestId: string
  retryable: boolean
  details?: ReadonlyArray<{ field?: string; reason: string }>
}

/** SSE 的 error frame 不使用 HTTP success envelope。 */
export interface PublicSseErrorEnvelope {
  errCode: string
  errMessage: string
  requestId: string
  retryable: boolean
}

export type PublicErrorPayload = PublicErrorEnvelope | PublicSseErrorEnvelope

/**
 * 校验 Retry-After header
 *
 * 根据 Design 文档 § "公共错误目录" 的规则：
 * - RATE_LIMITED: range 1-900s，header 值必须在 1 到 900 之间
 * - CHAT_IN_PROGRESS, CHAT_DEVICE_BUSY: range 1-30s，header 值必须在 1 到 30 之间
 * - PROVIDER_ERROR, NOT_READY: fixed 5s，header 值必须恰好是 5
 * - SERVICE_BUSY: fixed 1s，header 值必须恰好是 1
 * - MODEL_TIMEOUT: none，不能出现 Retry-After header
 */
function validateRetryAfterHeader(
  headers: Headers,
  retryAfter: RetryAfterPolicy,
  errCode: string,
): string | null {
  const headerValue = headers.get('Retry-After')

  if (retryAfter.kind === 'none') {
    // 不应该有 Retry-After header
    if (headerValue !== null) {
      return `Error ${errCode} should not have Retry-After header, but got: ${headerValue}`
    }
    return null
  }

  // kind === 'fixed' 或 'range'，必须有 header
  if (headerValue === null) {
    return `Error ${errCode} requires Retry-After header`
  }

  if (!/^[0-9]+$/.test(headerValue)) {
    return `Invalid Retry-After value: ${headerValue}`
  }
  const seconds = Number(headerValue)

  if (retryAfter.kind === 'fixed') {
    if (seconds !== retryAfter.seconds) {
      return `Retry-After must be exactly ${retryAfter.seconds} for ${errCode}, got ${seconds}`
    }
  } else {
    // kind === 'range'
    if (seconds < retryAfter.minSeconds || seconds > retryAfter.maxSeconds) {
      return `Retry-After must be between ${retryAfter.minSeconds} and ${retryAfter.maxSeconds} for ${errCode}, got ${seconds}`
    }
  }

  return null
}

/**
 * 校验公开错误 tuple (status + headers + body)
 *
 * @param status HTTP 状态码
 * @param headers 响应头
 * @param body 响应体
 * @param channel 通道类型 (json 或 sse)
 */
export function validatePublicErrorPayload(
  body: unknown,
  channel: 'json' | 'sse',
): ContractValidationResult<PublicErrorPayload> {
  const schemaId = channel === 'json' ? 'ErrorResponse' : 'SseErrorEvent'
  const contractResult = validateContract(schemaId, body)
  if (!contractResult.success) {
    return { success: false, error: `Invalid public error envelope: ${contractResult.error}` }
  }
  const envelope = contractResult.value as PublicErrorPayload

  // 错误目录是对两种传输 envelope 共同生效的第二层边界。
  const def = errorMap.get(envelope.errCode)
  if (!def) {
    return { success: false, error: `Unknown error code: ${envelope.errCode}` }
  }
  if (!def.channels.includes(channel)) {
    return {
      success: false,
      error: `Error ${envelope.errCode} not supported on ${channel} channel`,
    }
  }

  if (envelope.retryable !== def.retryable) {
    return {
      success: false,
      error: `retryable mismatch: expected ${def.retryable} for ${envelope.errCode}, got ${envelope.retryable}`,
    }
  }

  return { success: true, value: envelope }
}

export function validatePublicErrorTuple(
  status: number,
  headers: Headers,
  body: unknown,
  channel: 'json' | 'sse',
): ContractValidationResult<PublicErrorPayload> {
  const payloadResult = validatePublicErrorPayload(body, channel)
  if (!payloadResult.success) return payloadResult
  const envelope = payloadResult.value
  const def = errorMap.get(envelope.errCode)
  if (!def) {
    return { success: false, error: `Unknown error code: ${envelope.errCode}` }
  }

  if (def.httpStatus !== status) {
    return {
      success: false,
      error: `Status code mismatch: expected ${def.httpStatus} for ${envelope.errCode}, got ${status}`,
    }
  }

  // JSON 与显式构造的 SSE tuple 都需要服从目录的重试头规则。
  const retryAfterError = validateRetryAfterHeader(headers, def.retryAfter, envelope.errCode)
  if (retryAfterError) {
    return { success: false, error: retryAfterError }
  }

  return { success: true, value: envelope }
}
