/**
 * 公开错误 envelope — 唯一错误目录驱动
 *
 * 成功响应 { success: true, data }；失败响应
 * { success: false, errCode, errMessage, requestId, retryable, details? }。
 * HTTP status / retryable / Retry-After 全部来自
 * contracts/v1/source/openapi.yaml#x-mealmate-errors 的生成目录。
 */
import type { Context } from 'hono'
import { type PublicErrorCode, resolveErrorDefinition } from './contracts/error-catalog.js'

const DEFAULT_MESSAGES: Partial<Record<PublicErrorCode, string>> = {
  BAD_REQUEST: 'Invalid request',
  INVALID_CURSOR: 'Invalid or expired cursor',
  UNAUTHORIZED: 'Missing or invalid device token',
  INVALID_BOOTSTRAP_SECRET: 'Invalid bootstrap secret',
  INVALID_FAMILY_CODE: 'Invalid family code',
  DEVICE_NOT_FOUND: 'Device not found',
  ALREADY_INITIALIZED: 'Instance is already initialized',
  NOT_INITIALIZED: 'Instance is not initialized',
  IDEMPOTENCY_KEY_REUSED: 'Idempotency key reused with a different payload',
  RECIPE_NOT_FOUND: 'Recipe not found',
  RECIPE_DELETED: 'Recipe is deleted',
  RECIPE_IN_USE: 'Recipe is referenced by a current or future plan',
  RATE_LIMITED: 'Too many failed attempts',
  INTERNAL_ERROR: 'Internal server error',
  SYNC_CHANGE_TOO_LARGE: 'A sync change exceeds the page size limit',
  SERVICE_BUSY: 'Server is busy',
  NOT_READY: 'Server is not ready',
}

export interface PublicErrorDetail {
  field?: string
  reason: string
}

export interface PublicErrorOptions {
  message?: string
  retryAfterSeconds?: number
  details?: ReadonlyArray<PublicErrorDetail>
}

export class PublicError extends Error {
  readonly errCode: PublicErrorCode
  readonly retryAfterSeconds?: number
  readonly details?: ReadonlyArray<PublicErrorDetail>

  constructor(errCode: PublicErrorCode, options?: PublicErrorOptions) {
    super(options?.message ?? DEFAULT_MESSAGES[errCode] ?? errCode)
    this.name = 'PublicError'
    this.errCode = errCode
    this.retryAfterSeconds = options?.retryAfterSeconds
    this.details = options?.details
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 按唯一错误目录生成 envelope + HTTP status + Retry-After header。 */
export function errorResponse(c: Context, err: PublicError): Response {
  const def = resolveErrorDefinition(err.errCode)
  const requestId = c.get('requestId') ?? 'unknown'
  const envelope = {
    success: false,
    errCode: err.errCode,
    errMessage: err.message,
    requestId,
    retryable: def.retryable,
    ...(err.details === undefined ? {} : { details: err.details }),
  }

  const headers: Record<string, string> = {}
  if (def.retryAfter.kind === 'fixed') {
    headers['Retry-After'] = String(def.retryAfter.seconds)
  } else if (def.retryAfter.kind === 'range') {
    const seconds = clamp(
      err.retryAfterSeconds ?? def.retryAfter.minSeconds,
      def.retryAfter.minSeconds,
      def.retryAfter.maxSeconds,
    )
    headers['Retry-After'] = String(seconds)
  }

  return c.json(envelope, def.httpStatus, headers)
}

export function successEnvelope(c: Context, data: unknown): Response {
  return c.json({ success: true, data })
}
