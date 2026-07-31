import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { GenericContainer, Wait } from 'testcontainers'
import { describe, expect, it } from 'vitest'

describe('v0.1 migration', () => {
  it('is applied against PostgreSQL 16 by the integration environment', async () => {
    const container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'mealmate',
        POSTGRES_PASSWORD: 'test',
        POSTGRES_USER: 'mealmate',
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/))
      .start()
    const client = postgres({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      user: 'mealmate',
      password: 'test',
      database: 'mealmate',
    })
    try {
      await migrate(drizzle(client), {
        migrationsFolder: fileURLToPath(new URL('.', import.meta.url)),
      })
      const tables = await client<{ table_name: string }[]>`
        select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        order by table_name
      `
      expect(tables).toHaveLength(13)
      expect(tables.map((table) => table.table_name)).toContain('sync_changes')
    } finally {
      await client.end()
      await container.stop()
    }
  })
})
