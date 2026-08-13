import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { GenericContainer, Wait } from 'testcontainers'
import { describe, expect, it } from 'vitest'
import { recipeContractToInsert } from '../../contracts/mappers/recipe.js'
import { resolveMigrationsFolder } from '../migration-folder.js'
import {
  assignRecipeServerVersion,
  type Database,
  type SyncWriteTransaction,
  withSyncWriteTransaction,
} from './sync-write.js'

describe('withSyncWriteTransaction', () => {
  it('only adds a recipe serverVersion through a sync context allocator', async () => {
    const mapped = recipeContractToInsert({ name: 'transaction recipe' })
    await expect(
      assignRecipeServerVersion({ nextServerVersion: async () => 7n }, mapped),
    ).resolves.toMatchObject({ name: 'transaction recipe', serverVersion: 7n })
  })

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
      .withWaitStrategy(
        Wait.forAll([
          Wait.forListeningPorts(),
          Wait.forLogMessage(/database system is ready to accept connections/, 2),
        ]),
      )
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
        migrationsFolder: await resolveMigrationsFolder(
          fileURLToPath(new URL('../migrations/', import.meta.url)),
        ),
      })
      const recipeId = '23b3ad2e-ef4c-420d-b67c-474b4f33fa7e'
      const planId = '13b3ad2e-ef4c-420d-b67c-474b4f33fa7e'
      const deviceId = '33b3ad2e-ef4c-420d-b67c-474b4f33fa7e'
      await client.begin(async (tx) => {
        await tx.unsafe(
          `insert into recipes (id, name, tags, ingredients, steps, server_version)
           values ($1, 'existing recipe', '{}', '{}', '{}', 100)`,
          [recipeId],
        )
        await tx.unsafe(
          `insert into weekly_plans (id, week_start, server_version) values ($1, '2026-07-27', 101)`,
          [planId],
        )
        await tx.unsafe(
          `insert into plan_items (weekly_plan_id, date, meal_type, recipe_id, recipe_name_snapshot)
           select $1::uuid, '2026-07-27'::date + day_offset, meal_type, $2::uuid, 'existing recipe'
           from generate_series(0, 6) as day_offset
           cross join unnest(array['breakfast', 'lunch', 'dinner']) as meal_type`,
          [planId, recipeId],
        )
      })
      await client.unsafe(
        `insert into device_tokens (id, token_hash, device_name) values ($1, repeat('a', 64), 'test-device')`,
        [deviceId],
      )

      const observedQueries: string[] = []
      let expectSecondAdvisoryLock = false
      let secondAdvisoryLockAttempted: (() => void) | undefined
      const secondAdvisoryLockBarrier = new Promise<void>((resolve) => {
        secondAdvisoryLockAttempted = resolve
      })
      const db: Database = {
        transaction: async (work) =>
          drizzle(client).transaction(async (tx) =>
            work({
              execute: async (query) => {
                const queryText = JSON.stringify(query, (_key, value: unknown) =>
                  typeof value === 'bigint' ? value.toString() : value,
                )
                observedQueries.push(queryText)
                if (expectSecondAdvisoryLock && queryText.includes('pg_advisory_xact_lock')) {
                  secondAdvisoryLockAttempted?.()
                }
                return tx.execute(query)
              },
            }),
          ),
      }
      let releaseFirst: (() => void) | undefined
      const firstMayCommit = new Promise<void>((resolve) => {
        releaseFirst = resolve
      })
      let firstCallbackEntered: (() => void) | undefined
      const firstEntered = new Promise<void>((resolve) => {
        firstCallbackEntered = resolve
      })
      const first = withSyncWriteTransaction(
        db,
        [
          { resource: 'weekly_plan', id: planId },
          { resource: 'recipe', id: recipeId },
        ],
        async (context) => {
          const versions = [await context.nextServerVersion(), await context.nextServerVersion()]
          firstCallbackEntered?.()
          await firstMayCommit
          await context.tx.execute(
            sql`insert into auth_attempt_throttles (scope, source_key_hash) values ('bootstrap', repeat('f', 64))`,
          )
          return versions
        },
      )
      await firstEntered
      expect(
        observedQueries
          .slice(0, 3)
          .map((query) =>
            query.includes('recipes')
              ? 'recipe'
              : query.includes('weekly_plans')
                ? 'weekly_plan'
                : 'global',
          ),
      ).toEqual(['global', 'recipe', 'weekly_plan'])

      let secondCallbackEntered = false
      expectSecondAdvisoryLock = true
      const second = withSyncWriteTransaction(
        db,
        [{ resource: 'recipe', id: recipeId }],
        async (context) => {
          secondCallbackEntered = true
          const committed = await client<{ count: string }[]>`
            select count(*) as count from auth_attempt_throttles
            where scope = 'bootstrap' and source_key_hash = repeat('f', 64)
          `
          expect(committed[0]?.count).toBe('1')
          return context.nextServerVersion()
        },
      )
      await secondAdvisoryLockBarrier
      expect(secondCallbackEntered).toBe(false)
      releaseFirst?.()
      const firstVersions = await first
      const secondVersion = await second
      expect(firstVersions).toHaveLength(2)
      expect(firstVersions[1]).toBe((firstVersions[0] ?? 0n) + 1n)
      expect(secondVersion).toBe((firstVersions[1] ?? 0n) + 1n)
      expect(secondCallbackEntered).toBe(true)

      await expect(
        withSyncWriteTransaction(db, [], async (context) => {
          const version = await context.nextServerVersion()
          await context.tx.execute(
            sql`insert into recipes (name, tags, ingredients, steps, server_version) values ('rollback recipe', '{}', '{}', '{}', ${version})`,
          )
          await context.tx.execute(
            sql`insert into sync_changes (server_version, resource, resource_id, operation, payload, payload_schema_version) values (${version}, 'recipe', ${recipeId}, 'upsert', ${JSON.stringify({ id: recipeId, name: 'rollback recipe', tags: [], ingredients: [], steps: [], serverVersion: version.toString(), createdAt: '2026-07-26T00:00:00.000Z', updatedAt: '2026-07-26T00:00:00.000Z' })}::jsonb, 1)`,
          )
          await context.tx.execute(
            sql`insert into sync_action_receipts (device_id, action_id, action_type, payload_hash, status, result, result_schema_version) values (${deviceId}::uuid, '43b3ad2e-ef4c-420d-b67c-474b4f33fa7e'::uuid, 'recipe.patch', repeat('4', 64), 'rejected', ${JSON.stringify({ actionId: '43b3ad2e-ef4c-420d-b67c-474b4f33fa7e', status: 'rejected', errCode: 'BAD_REQUEST', errMessage: 'rollback' })}::jsonb, 1)`,
          )
          throw new Error('rollback')
        }),
      ).rejects.toThrow('rollback')
      const rows = await client<{ recipes: string; changes: string; receipts: string }[]>`
        select
          (select count(*) from recipes where name = 'rollback recipe') as recipes,
          (select count(*) from sync_changes) as changes,
          (select count(*) from sync_action_receipts) as receipts
      `
      expect(rows[0]).toEqual({ recipes: '0', changes: '0', receipts: '0' })
    } finally {
      await client.end()
      await container.stop()
    }
  })
})
