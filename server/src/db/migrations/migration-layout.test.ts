import { fileURLToPath } from 'node:url'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { describe, expect, it } from 'vitest'

describe('migration layout', () => {
  it('exposes the deterministic v0.1 contract-persistence migration to the runtime migrator', () => {
    const migrationsFolder = fileURLToPath(new URL('.', import.meta.url))

    expect(readMigrationFiles({ migrationsFolder })).toMatchObject([
      { folderMillis: 1_785_024_000_000, bps: true },
    ])
  })
})
