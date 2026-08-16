/**
 * Hono Context 变量类型 — request-id、设备认证与 Ajv 验证的共享存储
 */
import type { AuthenticatedDevice } from './device-auth.js'

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string
    device: AuthenticatedDevice
    json: unknown
    query: unknown
    param: unknown
  }
}
