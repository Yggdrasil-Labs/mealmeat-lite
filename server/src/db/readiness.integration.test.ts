import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertDatabaseSchemaCurrent, type ReadinessDatabase } from './migration-status.js'

async function currentMigrationHash(): Promise<string> {
  const migration = await readFile(
    fileURLToPath(new URL('./migrations/0000_v01_contract_persistence.sql', import.meta.url)),
  )
  return createHash('sha256').update(migration).digest('hex')
}

function isMigrationHistoryQuery(query: unknown): boolean {
  return JSON.stringify(query).includes('__drizzle_migrations')
}

describe('database readiness', () => {
  it('fails closed while migrations are pending', async () => {
    const db: ReadinessDatabase = {
      execute: async (query) => (isMigrationHistoryQuery(query) ? [] : [{ count: '0' }]),
    }
    await expect(assertDatabaseSchemaCurrent(db)).rejects.toMatchObject({ code: 'NOT_READY' })
  })

  it('fails closed for an unknown JSONB schema version', async () => {
    const hash = await currentMigrationHash()
    let checkedConversationVersion = false
    const db: ReadinessDatabase = {
      async execute(query) {
        const queryText = JSON.stringify(query)
        if (isMigrationHistoryQuery(query)) return [{ hash }]
        if (queryText.includes('conversations')) {
          checkedConversationVersion = true
          return [{ count: '1' }]
        }
        return [{ count: '0' }]
      },
    }
    await expect(assertDatabaseSchemaCurrent(db)).rejects.toMatchObject({
      code: 'NOT_READY',
      message: 'Database contains an unknown JSONB schema version',
    })
    expect(checkedConversationVersion).toBe(true)
  })

  it('rejects an applied migration with the right count but the wrong identity', async () => {
    const db: ReadinessDatabase = {
      async execute(query) {
        return isMigrationHistoryQuery(query) ? [{ hash: 'wrong-but-present' }] : [{ count: '0' }]
      },
    }

    await expect(assertDatabaseSchemaCurrent(db)).rejects.toMatchObject({ code: 'NOT_READY' })
  })

  it('accepts the exact applied migration hash and all known JSONB versions', async () => {
    const hash = await currentMigrationHash()
    const db: ReadinessDatabase = {
      async execute(query) {
        return isMigrationHistoryQuery(query) ? [{ hash }] : [{ count: '0' }]
      },
    }

    await expect(assertDatabaseSchemaCurrent(db)).resolves.toBeUndefined()
  })
})
