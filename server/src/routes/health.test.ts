import { beforeEach, describe, expect, it, vi } from 'vitest'

const { assertDatabaseSchemaCurrent } = vi.hoisted(() => ({ assertDatabaseSchemaCurrent: vi.fn() }))

vi.mock('../utils/db.js', () => ({
  createSql: () => async () => [{ ok: 1 }],
}))

vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: () => ({ execute: async () => [] }) }))

vi.mock('../db/migration-status.js', () => ({ assertDatabaseSchemaCurrent }))

import { healthRoutes } from './health.js'

describe('health routes', () => {
  beforeEach(() => assertDatabaseSchemaCurrent.mockReset())
  describe('GET /health/live', () => {
    it('returns 200 with status ok', async () => {
      const res = await healthRoutes.request('/live')
      expect(res.status).toBe(200)
      const body = (await res.json()) as { status: string }
      expect(body).toEqual({ status: 'ok' })
    })
  })

  describe('GET /health/ready', () => {
    it('returns 503 NOT_READY when schema readiness rejects a migration mismatch', async () => {
      assertDatabaseSchemaCurrent.mockRejectedValueOnce(
        Object.assign(new Error('migration mismatch'), { code: 'NOT_READY' }),
      )

      const res = await healthRoutes.request('/ready')

      expect(res.status).toBe(503)
      expect(await res.json()).toMatchObject({ status: 'not ready', code: 'NOT_READY' })
    })

    it('returns 200 when database connectivity and schema readiness succeed', async () => {
      assertDatabaseSchemaCurrent.mockResolvedValueOnce(undefined)
      const res = await healthRoutes.request('/ready')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ status: 'ready' })
    })
  })
})
