import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { GenericContainer, Wait } from 'testcontainers'
import { describe, expect, it } from 'vitest'
import { type Database, type SyncWriteTransaction, withSyncWriteTransaction } from './sync-write.js'

describe('withSyncWriteTransaction', () => {
  it('takes its global and sorted resource locks before exposing a version allocator', async () => {
    const calls: string[] = []
    const tx: SyncWriteTransaction = {
      async execute() {
        calls.push('lock-or-version')
        return calls.length === 4 ? [{ version: '42' }] : []
      },
    }
    const db: Database = { transaction: (work) => work(tx) }

    const version = await withSyncWriteTransaction(
      db,
      [
        { resource: 'weekly_plan', id: 'b' },
        { resource: 'recipe', id: 'z' },
      ],
      async (context) => {
        expect(calls).toHaveLength(3)
        return context.nextServerVersion()
      },
    )

    expect(version).toBe(42n)
    expect(calls).toHaveLength(4)
  })

  it('propagates a failing callback so the Drizzle transaction can roll back atomically', async () => {
    const tx: SyncWriteTransaction = { execute: async () => [] }
    const db: Database = { transaction: (work) => work(tx) }

    await expect(
      withSyncWriteTransaction(db, [], async () => {
        throw new Error('intentional rollback')
      }),
    ).rejects.toThrow('intentional rollback')
  })

  it('uses PostgreSQL locks, contiguous versions, and transaction rollback when a runtime is available', async () => {
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
        migrationsFolder: fileURLToPath(new URL('../migrations/', import.meta.url)),
      })
      const db = drizzle(client) as unknown as Database
      const versions = await withSyncWriteTransaction(
        db,
        [
          { resource: 'weekly_plan', id: '13b3ad2e-ef4c-420d-b67c-474b4f33fa7e' },
          { resource: 'recipe', id: '23b3ad2e-ef4c-420d-b67c-474b4f33fa7e' },
        ],
        async (context) => [await context.nextServerVersion(), await context.nextServerVersion()],
      )
      expect(versions).toHaveLength(2)
      expect(versions[1]).toBe((versions[0] ?? 0n) + 1n)

      await expect(
        withSyncWriteTransaction(db, [], async (context) => {
          const version = await context.nextServerVersion()
          await context.tx.execute(
            sql`insert into sync_changes (server_version, resource, operation, payload, payload_schema_version) values (${version}, 'recipe', 'upsert', ${JSON.stringify({})}::jsonb, 1)`,
          )
          throw new Error('rollback')
        }),
      ).rejects.toThrow('rollback')
      const rows = await client<{ count: string }[]>`select count(*) as count from sync_changes`
      expect(rows[0]?.count).toBe('0')
    } finally {
      await client.end()
      await container.stop()
    }
  })
})
