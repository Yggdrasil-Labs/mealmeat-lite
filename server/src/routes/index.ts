/**
 * API v1 路由聚合 — 1 MB body 上限 + auth/sync
 */
import { Hono } from 'hono'
import { bodyLimit, MAX_JSON_BODY_BYTES } from '../middleware/body-limit.js'

export interface ApiV1Deps {
  authRoutes: Hono
  syncRoutes: Hono
  modelsRoutes: Hono
}

export function createApiV1(deps: ApiV1Deps): Hono {
  const api = new Hono()
  api.use('*', bodyLimit(MAX_JSON_BODY_BYTES))
  api.route('/auth', deps.authRoutes)
  api.route('/sync', deps.syncRoutes)
  api.route('/', deps.modelsRoutes)
  return api
}
