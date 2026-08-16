/**
 * 设备认证中间件 — Bearer token → SHA-256 查询未吊销 device_tokens
 *
 * 失败统一 401 UNAUTHORIZED，不泄露令牌状态。
 * 成功后在 Context 写入 device 并刷新 last_used_at。
 */
import { and, eq, isNull } from 'drizzle-orm'
import type { MiddlewareHandler } from 'hono'
import type { Db } from '../db/pool.js'
import { deviceTokens } from '../db/schema/auth.js'
import { PublicError } from '../errors.js'
import { DEVICE_TOKEN_PATTERN, sha256Hex } from '../security/crypto.js'

export interface AuthenticatedDevice {
  id: string
  deviceName: string
}

export interface DeviceAuthDeps {
  getDb(): Db
}

export function getDevice(c: { get(key: 'device'): AuthenticatedDevice }): AuthenticatedDevice {
  return c.get('device')
}

export function createDeviceAuth(deps: DeviceAuthDeps): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header('authorization')
    if (header === undefined || !header.startsWith('Bearer ')) {
      throw new PublicError('UNAUTHORIZED')
    }
    const token = header.slice('Bearer '.length).trim()
    if (!DEVICE_TOKEN_PATTERN.test(token)) {
      throw new PublicError('UNAUTHORIZED')
    }

    const tokenHash = sha256Hex(token)
    const rows = await deps
      .getDb()
      .select({ id: deviceTokens.id, deviceName: deviceTokens.deviceName })
      .from(deviceTokens)
      .where(and(eq(deviceTokens.tokenHash, tokenHash), isNull(deviceTokens.revokedAt)))
      .limit(1)
    const row = rows[0]
    if (row === undefined) {
      throw new PublicError('UNAUTHORIZED')
    }

    c.set('device', { id: row.id, deviceName: row.deviceName })
    await deps
      .getDb()
      .update(deviceTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(deviceTokens.id, row.id))

    await next()
  }
}
