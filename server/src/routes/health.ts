import { Hono } from 'hono'

export const healthRoutes = new Hono()

/**
 * Liveness probe — 进程可服务即返回 ok
 */
healthRoutes.get('/live', (c) => {
  return c.json({ status: 'ok' })
})

/**
 * Readiness probe — DB 可连接、迁移版本匹配、配置有效时返回 ready
 * TODO: 阶段 1 实现完整就绪检查
 */
healthRoutes.get('/ready', (c) => {
  return c.json({ status: 'ready' })
})
