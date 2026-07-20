import { zValidator as originalZValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodSchema } from 'zod'

/**
 * zValidator wrapper — 确保验证失败时返回结构化 JSON 错误响应
 *
 * 原始 @hono/zod-validator 在无 hook 时返回纯文本 400 "Invalid xxx"，
 * 这不符合 API 结构化错误响应约定。此 wrapper 统一返回:
 * { error: { code: 400, message: "Validation failed", issues: [...] } }
 */
export const zValidator = <T extends ZodSchema, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) =>
  originalZValidator(target, schema, (result, c) => {
    if (!result.success) {
      const isProduction = process.env.NODE_ENV === 'production'
      return c.json(
        {
          error: {
            code: 400,
            message: 'Validation failed',
            issues: result.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
              code: issue.code,
              // 非生产环境返回额外调试信息
              ...(!isProduction && 'received' in issue && { received: issue.received }),
            })),
          },
        },
        400,
      )
    }
  })
