/**
 * 错误目录
 *
 * 从生成的协议目录解析错误定义，校验错误 tuple
 */

import { errorMap } from './generated/catalogs.js'
import type { ContractValidationResult, PublicErrorDefinition, RetryAfterPolicy } from './types.js'

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
  errCode: string
  message: string
  details?: Record<string, unknown>
}

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

  const seconds = Number.parseInt(headerValue, 10)
  if (Number.isNaN(seconds) || seconds < 0) {
    return `Invalid Retry-After value: ${headerValue}`
  }

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
export function validatePublicErrorTuple(
  status: number,
  headers: Headers,
  body: unknown,
  channel: 'json' | 'sse',
): ContractValidationResult<PublicErrorEnvelope> {
  // 1. 校验 body 基本结构
  if (!body || typeof body !== 'object') {
    return { success: false, error: 'Body must be an object' }
  }

  const envelope = body as Record<string, unknown>

  // 2. 校验必需字段
  if (typeof envelope.errCode !== 'string') {
    return { success: false, error: 'Missing or invalid errCode' }
  }
  if (typeof envelope.message !== 'string') {
    return { success: false, error: 'Missing or invalid message' }
  }

  // 3. 查找错误定义
  const def = errorMap.get(envelope.errCode)
  if (!def) {
    return { success: false, error: `Unknown error code: ${envelope.errCode}` }
  }

  // 4. 校验状态码匹配
  if (def.httpStatus !== status) {
    return {
      success: false,
      error: `Status code mismatch: expected ${def.httpStatus} for ${envelope.errCode}, got ${status}`,
    }
  }

  // 5. 校验通道支持
  if (!def.channels.includes(channel)) {
    return {
      success: false,
      error: `Error ${envelope.errCode} not supported on ${channel} channel`,
    }
  }

  // 6. 校验 Retry-After header
  const retryAfterError = validateRetryAfterHeader(headers, def.retryAfter, envelope.errCode)
  if (retryAfterError) {
    return { success: false, error: retryAfterError }
  }

  return {
    success: true,
    value: {
      errCode: envelope.errCode,
      message: envelope.message,
      details: envelope.details as Record<string, unknown> | undefined,
    },
  }
}
