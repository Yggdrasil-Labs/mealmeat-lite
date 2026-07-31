import { describe, expect, it } from 'vitest'
import { assertDatabaseSchemaCurrent, type ReadinessDatabase } from './status.js'

describe('database readiness', () => {
  it('fails closed while migrations are pending', async () => {
    const db: ReadinessDatabase = { execute: async () => [{ count: '0' }] }
    await expect(assertDatabaseSchemaCurrent(db)).rejects.toMatchObject({ code: 'NOT_READY' })
  })

  it('fails closed for an unknown JSONB schema version', async () => {
    let calls = 0
    const db: ReadinessDatabase = {
      async execute() {
        calls += 1
        return [{ count: calls === 1 ? '1' : calls === 3 ? '1' : '0' }]
      },
    }
    await expect(assertDatabaseSchemaCurrent(db)).rejects.toMatchObject({ code: 'NOT_READY' })
  })
})
