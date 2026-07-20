import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

/**
 * 全局错误处理器 — 拦截所有未被路由捕获的异常
 *
 * - HTTPException: 返回对应状态码 + 结构化消息
 * - 其他异常: 返回 500 + 不泄露内部细节
 */
export const onError: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      {
        error: {
          code: err.status,
          message: err.message || 'Request failed',
        },
      },
      err.status,
    )
  }

  // 生产环境不泄露 stack trace；开发环境通过日志查看
  console.error('[uncaught]', err)

  return c.json(
    {
      error: {
        code: 500,
        message: 'Internal Server Error',
      },
    },
    500,
  )
}
