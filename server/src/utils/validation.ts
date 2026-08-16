/**
 * Hono 验证适配器 — Ajv strict validator → 400 BAD_REQUEST envelope
 *
 * 非法 JSON、缺字段与 strict schema 多余字段统一映射为 BAD_REQUEST，
 * details 携带 instancePath 与原因；不向生产日志输出请求内容。
 */
import type { ErrorObject } from 'ajv'
import type { Context, MiddlewareHandler, ValidationTargets } from 'hono'
import { getValidator } from '../contracts/generated/validators.js'
import { PublicError } from '../errors.js'

interface ValidationConfig {
  file: string
  defPath: string
}

export function ajvValidator<Target extends keyof ValidationTargets>(
  target: Target,
  config: ValidationConfig,
): MiddlewareHandler {
  return async (c: Context, next) => {
    let data: unknown
    if (target === 'json') {
      try {
        data = await c.req.json()
      } catch {
        throw new PublicError('BAD_REQUEST', { message: 'Invalid JSON body' })
      }
    } else if (target === 'query') {
      data = c.req.query()
    } else if (target === 'param') {
      data = c.req.param()
    } else {
      return next()
    }

    const validator = getValidator(config.file, config.defPath)
    if (!validator(data)) {
      throw new PublicError('BAD_REQUEST', {
        message: 'Request validation failed',
        details: validator.errors?.map((error: ErrorObject) => ({
          field: error.instancePath || '/',
          reason: error.message ?? 'Invalid value',
        })),
      })
    }

    c.set(target, data)
    return next()
  }
}
