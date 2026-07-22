import { fileURLToPath } from 'node:url'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { describe, expect, it } from 'vitest'

describe('migration layout', () => {
  it('allows the bootstrap migration command to run before the first schema migration exists', () => {
    const migrationsFolder = fileURLToPath(new URL('.', import.meta.url))

    expect(readMigrationFiles({ migrationsFolder })).toEqual([])
  })
})
