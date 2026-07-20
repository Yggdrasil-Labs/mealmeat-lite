import { describe, expect, it } from 'vitest'
import { healthRoutes } from './health.js'

describe('health routes', () => {
  describe('GET /health/live', () => {
    it('returns 200 with status ok', async () => {
      const res = await healthRoutes.request('/live')
      expect(res.status).toBe(200)
      const body = (await res.json()) as { status: string }
      expect(body).toEqual({ status: 'ok' })
    })
  })

  describe('GET /health/ready', () => {
    it('returns 503 when DB_PASSWORD is not configured', async () => {
      const res = await healthRoutes.request('/ready')
      expect(res.status).toBe(503)
      const body = (await res.json()) as { status: string; reason?: string }
      expect(body.status).toBe('not ready')
    })
  })
})
