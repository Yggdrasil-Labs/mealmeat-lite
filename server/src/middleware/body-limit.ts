/**
 * JSON body 大小上限 — /api/v1 固定 1 MB
 *
 * 基于 hono/body-limit：content-length 快进路径之外，无长度的 chunked 传输
 * 在流式读取时按累计字节数强制截断，超限返回 400 BAD_REQUEST envelope。
 */

import type { MiddlewareHandler } from 'hono'
import { bodyLimit as honoBodyLimit } from 'hono/body-limit'
import { errorResponse, PublicError } from '../errors.js'

export const MAX_JSON_BODY_BYTES = 1_048_576

export function bodyLimit(maxBytes: number): MiddlewareHandler {
  return honoBodyLimit({
    maxSize: maxBytes,
    onError: (c) =>
      errorResponse(c, new PublicError('BAD_REQUEST', { message: 'Request body too large' })),
  })
}
