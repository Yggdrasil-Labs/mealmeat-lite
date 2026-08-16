import type { NotFoundHandler } from 'hono'

/**
 * 全局 404 处理器 — 处理所有未匹配路由的请求
 *
 * 返回结构化 JSON 而非 Hono 默认的纯文本 "404 Not Found"。
 * 生产环境不暴露实际请求路径，仅返回通用消息。
 *
 * 文档化偏离：冻结错误目录没有通用 404 码（补码需新契约版本），
 * 因此本响应无法使用 {success:false,...} envelope；request-id 中间件
 * 仍会附加 X-Request-Id 头。已定义路由的失败响应全部走目录 envelope。
 */
export const onNotFound: NotFoundHandler = (c) => {
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Route not found'
      : `Route not found: ${c.req.method} ${c.req.path}`

  return c.json(
    {
      error: {
        code: 404,
        message,
      },
    },
    404,
  )
}
