import { serve } from '@hono/node-server'
import { app } from './app.js'

const port = Number(process.env.PORT ?? '3000')

/**
 * Process-level 错误处理 — 确保未捕获异常不会静默失败
 *
 * uncaughtException: 同步代码未捕获的异常，立即退出（进程状态可能不一致）
 * unhandledRejection: 未处理的 Promise rejection，尝试 graceful shutdown
 */
process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException:', err.message, err.stack)
  process.exit(1)
})

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`)
})

process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason)
  console.error('[fatal] unhandledRejection:', message)
  server.close(() => {
    process.exit(1)
  })
  // 兜底：如果 graceful shutdown 因长连接（如 SSE）挂起，5s 后强制退出
  setTimeout(() => process.exit(1), 5000).unref()
})
