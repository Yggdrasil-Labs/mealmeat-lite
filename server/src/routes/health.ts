import { Hono } from 'hono'
import { createSql } from '../utils/db.js'

export const healthRoutes = new Hono()

/**
 * 共享 DB 连接实例 — lazy 初始化，供 readiness probe 复用
 *
 * 避免每次 healthcheck 创建/销毁连接（Docker 默认 10s 间隔）。
 * max: 1 限制连接池大小，idle_timeout: 60s 空闲后自动释放。
 */
let healthSql: ReturnType<typeof createSql> | null = null

function getHealthSql() {
  if (!healthSql) {
    healthSql = createSql({
      connect_timeout: 5,
      idle_timeout: 60,
      max: 1,
    })
  }
  return healthSql
}

/**
 * Liveness probe — 进程可服务即返回 ok（Kubernetes / Docker 标准约定）
 */
healthRoutes.get('/live', (c) => {
  return c.json({ status: 'ok' })
})

/**
 * Readiness probe — 验证数据库连接可用
 *
 * 仅在以下条件全部满足时返回 200:
 * 1. PostgreSQL 连接可建立
 * 2. 一个轻量查询可执行（验证连接非僵尸）
 */
healthRoutes.get('/ready', async (c) => {
  try {
    const sql = getHealthSql()

    // 执行轻量查询验证数据库可达且可响应
    const result = await sql`SELECT 1 AS ok`
    if (result[0]?.ok !== 1) {
      return c.json({ status: 'not ready' }, 503)
    }
    return c.json({ status: 'ready' })
  } catch (err) {
    // 连接失败时重置实例，下次 probe 会重新建立连接
    healthSql = null
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error('[health] readiness check failed:', message)
    // 生产环境不泄露内部错误详情
    const reason = process.env.NODE_ENV === 'production' ? undefined : message
    return c.json({ status: 'not ready', ...(reason && { reason }) }, 503)
  }
})
