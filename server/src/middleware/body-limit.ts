/**
 * JSON body 大小上限 — /api/v1 固定 1 MB
 */
import type { MiddlewareHandler } from 'hono'
import { PublicError } from '../errors.js'

export const MAX_JSON_BODY_BYTES = 1_048_576

export function bodyLimit(maxBytes: number): MiddlewareHandler {
  return async (c, next) => {
    const contentLength = c.req.header('content-length')
    if (contentLength !== undefined) {
      const length = Number(contentLength)
      if (!Number.isFinite(length) || length < 0 || length > maxBytes) {
        throw new PublicError('BAD_REQUEST', { message: 'Request body too large' })
      }
    }
    await next()
  }
}
