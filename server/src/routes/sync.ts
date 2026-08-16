/**
 * 同步路由 — GET /sync 分页快照/增量，POST /sync/actions 离线动作上传
 */
import { Hono } from 'hono'
import type { SyncActionsRequest } from '../contracts/generated/schemas.js'
import { PublicError, successEnvelope } from '../errors.js'
import { getDevice } from '../middleware/device-auth.js'
import type { SyncService } from '../services/sync/sync-service.js'
import { ajvValidator } from '../utils/validation.js'

const DEFAULT_PAGE_LIMIT = 100
const MAX_PAGE_LIMIT = 100

function parseLimitQuery(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_PAGE_LIMIT
  if (!/^[1-9][0-9]*$/.test(raw) || Number(raw) > MAX_PAGE_LIMIT) {
    throw new PublicError('BAD_REQUEST', { message: 'Invalid limit' })
  }
  return Number(raw)
}

export function createSyncRoutes(deps: {
  sync: SyncService
  deviceAuth: ReturnType<typeof import('../middleware/device-auth.js').createDeviceAuth>
}): Hono {
  const routes = new Hono()
  routes.use('*', deps.deviceAuth)

  routes.get('/', async (c) => {
    const cursor = c.req.query('cursor') ?? null
    const limit = parseLimitQuery(c.req.query('limit'))
    const data = await deps.sync.syncChanges(cursor, limit)
    return successEnvelope(c, data)
  })

  routes.post(
    '/actions',
    ajvValidator('json', { file: 'sync.schema.json', defPath: '/$defs/SyncActionsRequest' }),
    async (c) => {
      const body = c.get('json') as SyncActionsRequest
      const data = await deps.sync.applyActions(getDevice(c).id, body.actions)
      return successEnvelope(c, data)
    },
  )

  return routes
}
