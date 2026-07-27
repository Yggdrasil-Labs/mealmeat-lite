/**
 * Hono 验证适配器
 *
 * 基于 Ajv 的结构化错误响应，替代原 zValidator
 */

import type { ErrorObject } from 'ajv'
import type { Context, MiddlewareHandler, ValidationTargets } from 'hono'
import { getValidator } from '../contracts/generated/validators.js'

interface ValidationConfig {
  file: string
  defPath: string
}

/**
 * Ajv 验证中间件 - 返回结构化 JSON 错误响应
 */
export function ajvValidator<Target extends keyof ValidationTargets>(
  target: Target,
  config: ValidationConfig,
): MiddlewareHandler {
  return async (c: Context, next) => {
    let data: unknown

    if (target === 'json') {
      data = await c.req.json()
    } else if (target === 'query') {
      data = c.req.query()
    } else if (target === 'param') {
      data = c.req.param()
    } else {
      return next()
    }

    const validator = getValidator(config.file, config.defPath)
    if (!validator(data)) {
      const isProduction = process.env.NODE_ENV === 'production'
      return c.json(
        {
          error: {
            code: 400,
            message: 'Validation failed',
            issues: validator.errors?.map((e: ErrorObject) => ({
              path: e.instancePath || '/',
              message: e.message || 'Unknown error',
              keyword: e.keyword,
              ...(!isProduction && e.params && { params: e.params }),
            })),
          },
        },
        400,
      )
    }

    // 存储验证后的数据供路由使用
    c.set(target, data)
    return next()
  }
}
