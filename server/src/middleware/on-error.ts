/**
 * 全局错误处理器 — 只经 PublicError/错误目录输出公开错误
 *
 * - PublicError: 按唯一错误目录生成 envelope + status + Retry-After
 * - HTTPException: 非法 JSON 等 → 400 BAD_REQUEST
 * - PostgresError 55P03/57014/08xxx: 锁/语句/连接超时 → 503 SERVICE_BUSY（事务已回滚）
 * - 其它: 500 INTERNAL_ERROR，日志只记 requestId + 错误元数据
 */
import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { PostgresError } from 'postgres'
import { unwrapPostgresError } from '../db/postgres-error.js'
import { errorResponse, PublicError } from '../errors.js'

function isBusyPostgresError(err: PostgresError): boolean {
  const code = err.code ?? ''
  return code === '55P03' || code === '57014' || code.startsWith('08')
}

export const onError: ErrorHandler = (err, c) => {
  if (err instanceof PublicError) {
    return errorResponse(c, err)
  }

  const postgresError = unwrapPostgresError(err)
  if (postgresError !== null) {
    if (isBusyPostgresError(postgresError)) {
      return errorResponse(c, new PublicError('SERVICE_BUSY', { retryAfterSeconds: 1 }))
    }
    console.error('[db-error]', {
      requestId: c.get('requestId'),
      code: postgresError.code,
      message: postgresError.message,
    })
    return errorResponse(c, new PublicError('INTERNAL_ERROR'))
  }

  if (err instanceof HTTPException) {
    return errorResponse(c, new PublicError('BAD_REQUEST', { message: 'Invalid request' }))
  }

  console.error('[uncaught]', {
    requestId: c.get('requestId'),
    message: err instanceof Error ? err.message : String(err),
  })
  return errorResponse(c, new PublicError('INTERNAL_ERROR'))
}
