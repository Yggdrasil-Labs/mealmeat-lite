/**
 * request-id 中间件 — 每个请求分配 UUID 并写入响应头与错误 envelope
 */
import { randomUUID } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'

export function requestId(): MiddlewareHandler {
  return async (c, next) => {
    const id = randomUUID()
    c.set('requestId', id)
    c.header('X-Request-Id', id)
    await next()
  }
}
