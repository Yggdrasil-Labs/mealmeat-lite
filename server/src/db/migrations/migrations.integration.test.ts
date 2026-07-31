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
      expect(tables.map((table) => table.table_name)).toEqual([
        'auth_attempt_throttles',
        'auth_config',
        'chat_request_receipts',
        'conversations',
        'device_tokens',
        'pending_confirmations',
        'plan_items',
        'recipes',
        'settings',
        'sync_action_receipts',
        'sync_changes',
        'weekly_plans',
      ])
      const jsonbCarriers = await client<{ column_name: string }[]>`
        select column_name from information_schema.columns
        where table_schema = 'public' and data_type = 'jsonb'
        order by column_name
      `
      expect(jsonbCarriers).toHaveLength(7)
      const constraintNames = await client<{ conname: string }[]>`
        select conname from pg_constraint where connamespace = 'public'::regnamespace
      `
      expect(constraintNames.map((row) => row.conname)).toEqual(
        expect.arrayContaining([
          'pending_confirmations_chat_receipt_fk',
          'chat_request_receipts_tool_receipts_version_pair_check',
          'sync_action_receipts_status_check',
        ]),
      )
    } finally {
      await client.end()
      await container.stop()
    }
  })
})
