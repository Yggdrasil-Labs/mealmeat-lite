/**
 * 认证路由 — bootstrap/register 公开，其余要求 device auth
 */
import type { Context, MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import type { BootstrapRequest, RegisterRequest } from '../contracts/generated/schemas.js'
import { PublicError, successEnvelope } from '../errors.js'
import { getDevice } from '../middleware/device-auth.js'
import type { AuthService } from '../services/auth/auth-service.js'
import { ajvValidator } from '../utils/validation.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export interface AuthRoutesDeps {
  auth: AuthService
  deviceAuth: MiddlewareHandler
  resolveSource(c: Context): string | null
}

export function createAuthRoutes(deps: AuthRoutesDeps): Hono {
  const routes = new Hono()

  routes.post(
    '/bootstrap',
    ajvValidator('json', { file: 'auth.schema.json', defPath: '/$defs/BootstrapRequest' }),
    async (c) => {
      const body = c.get('json') as BootstrapRequest
      const data = await deps.auth.bootstrap(body, deps.resolveSource(c))
      return successEnvelope(c, data)
    },
  )

  routes.post(
    '/register',
    ajvValidator('json', { file: 'auth.schema.json', defPath: '/$defs/RegisterRequest' }),
    async (c) => {
      const body = c.get('json') as RegisterRequest
      const data = await deps.auth.register(body, deps.resolveSource(c))
      return successEnvelope(c, data)
    },
  )

  routes.post('/logout', deps.deviceAuth, async (c) => {
    const data = await deps.auth.logout(getDevice(c).id)
    return successEnvelope(c, data)
  })

  routes.get('/devices', deps.deviceAuth, async (c) => {
    const data = await deps.auth.listDevices(getDevice(c).id)
    return successEnvelope(c, data)
  })

  routes.delete('/devices/:id', deps.deviceAuth, async (c) => {
    const id = c.req.param('id')
    if (!UUID_PATTERN.test(id)) {
      throw new PublicError('BAD_REQUEST', { message: 'Invalid device id' })
    }
    const data = await deps.auth.revokeDevice(id)
    return successEnvelope(c, data)
  })

  routes.post('/family-code/rotate', deps.deviceAuth, async (c) => {
    const familyCode = await deps.auth.rotateFamilyCode()
    return successEnvelope(c, { familyCode })
  })

  return routes
}
