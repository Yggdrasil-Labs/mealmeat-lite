import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { GenericContainer, Wait } from 'testcontainers'
import { describe, expect, it } from 'vitest'
import { resolveMigrationsFolder } from '../db/migration-folder.js'
import { weeklyPlanRowsToContract } from './mappers/plan.js'
import { recipeRowToContract } from './mappers/recipe.js'
import { syncChangeRowToContract } from './mappers/sync.js'
import { validateVersionedJsonb } from './mappers/versioned-jsonb.js'
import { validateContract } from './validation.js'

type Category = 'schema' | 'protocol-invariant' | 'error-tuple' | 'trace'

interface Fixture {
  id: string
  schemaId: Parameters<typeof validateContract>[0]
  expected: 'accept' | 'reject'
  expectedCategory: Category
  consumers: readonly ('server' | 'android' | 'postgres' | 'room')[]
  value: Record<string, unknown>
}

async function postgresFixtures(): Promise<Fixture[]> {
  const root = new URL('../../../contracts/v1/fixtures/', import.meta.url)
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8')) as {
    files: string[]
  }
  const files = await Promise.all(
    manifest.files
      .filter((path) => path.endsWith('.jsonl'))
      .map((path) => readFile(new URL(path, root), 'utf8')),
  )
  const fixtures = files
    .flatMap((body) =>
      body
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Fixture),
    )
    .filter((fixture) => fixture.consumers.includes('postgres'))

  for (const fixture of fixtures) {
    if (fixture.expected === 'reject' && fixture.expectedCategory !== 'schema') {
      throw new Error(
        `PostgreSQL fixture ${fixture.id} must use schema rejection; it has no protocol-invariant gate`,
      )
    }
  }
  return fixtures
}

function normalizeRfc3339Timestamps(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeRfc3339Timestamps)
  if (value === null || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      (key === 'createdAt' || key === 'updatedAt') && typeof entry === 'string'
        ? new Date(entry).toISOString()
        : normalizeRfc3339Timestamps(entry),
    ]),
  )
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected fixture object')
  }
  return value as Record<string, unknown>
}

function asString(value: unknown): string {
  if (typeof value !== 'string') throw new Error(`Expected fixture string, got ${typeof value}`)
  return value
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error('Expected fixture string array')
  }
  return value
}

function asRfc3339Timestamp(value: unknown): string {
  const timestamp = asString(value)
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) throw new Error('Expected valid fixture date')
  return timestamp
}

async function insertSyncChange(
  client: postgres.ISql,
  change: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<void> {
  await client`
    insert into sync_changes (server_version, resource, operation, payload, payload_schema_version)
    values (
      ${asString(change.serverVersion)}::bigint,
      ${asString(change.resource)},
      ${asString(change.operation)},
      ${JSON.stringify(data)}::jsonb,
      1
    )
  `
}

async function expectStoredSyncChange(
  client: postgres.ISql,
  change: Record<string, unknown>,
): Promise<void> {
  const rows = await client<
    Array<{
      server_version: string | bigint
      resource: string
      operation: string
      payload: unknown
      payload_schema_version: number
      created_at: Date | string
    }>
  >`
    select server_version, resource, operation, payload, payload_schema_version, created_at
    from sync_changes
  `
  const row = rows[0]
  if (row === undefined) throw new Error('Expected persisted sync change')
  expect(
    syncChangeRowToContract({
      serverVersion: BigInt(row.server_version),
      resource: row.resource as 'recipe' | 'weekly_plan' | 'settings',
      operation: row.operation as 'upsert' | 'delete',
      payload: row.payload,
      payloadSchemaVersion: row.payload_schema_version,
      createdAt: new Date(row.created_at),
    }),
  ).toEqual(change)
}

async function persistAndAssertFixture(client: postgres.Sql, fixture: Fixture): Promise<void> {
  const change = fixture.value
  const data = asRecord(change.data)
  await client`truncate table sync_changes, plan_items, weekly_plans, settings, recipes cascade`

  if (change.resource === 'recipe') {
    if (change.operation === 'delete') {
      await insertSyncChange(client, change, data)
      await expectStoredSyncChange(client, change)
      return
    }
    await client`
      insert into recipes (id, name, tags, ingredients, steps, image_url, notes, server_version, created_at, updated_at)
      values (
        ${asString(data.id)}::uuid,
        ${asString(data.name)},
        ${asStrings(data.tags)},
        ${asStrings(data.ingredients)},
        ${asStrings(data.steps)},
        null,
        null,
        ${asString(data.serverVersion)}::bigint,
        ${asRfc3339Timestamp(data.createdAt)}::timestamptz,
        ${asRfc3339Timestamp(data.updatedAt)}::timestamptz
      )
    `
    await insertSyncChange(client, change, data)
    const rows = await client<
      Array<{
        id: string
        name: string
        tags: string[]
        ingredients: string[]
        steps: string[]
        image_url: string | null
        notes: string | null
        deleted_at: Date | string | null
        server_version: string | bigint
        created_at: Date | string
        updated_at: Date | string
      }>
    >`
      select id, name, tags, ingredients, steps, image_url, notes, deleted_at, server_version, created_at, updated_at
      from recipes
    `
    const row = rows[0]
    if (row === undefined) throw new Error('Expected persisted recipe')
    expect(
      normalizeRfc3339Timestamps(
        recipeRowToContract({
          id: row.id,
          name: row.name,
          tags: row.tags,
          ingredients: row.ingredients,
          steps: row.steps,
          imageUrl: row.image_url,
          notes: row.notes,
          deletedAt: row.deleted_at === null ? null : new Date(row.deleted_at),
          serverVersion: BigInt(row.server_version),
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        }),
      ),
    ).toEqual(normalizeRfc3339Timestamps(data))
    await expectStoredSyncChange(client, change)
    return
  }

  if (change.resource === 'weekly_plan') {
    const items = (data.items as unknown[]).map(asRecord)
    await client.begin(async (transaction) => {
      await transaction`
        insert into recipes (id, name, tags, ingredients, steps, server_version)
        values (${asString(items[0]?.recipeId)}::uuid, 'fixture recipe', '{}', '{}', '{}', 1)
      `
      await transaction`
        insert into weekly_plans (id, week_start, server_version, created_at, updated_at)
        values (
          ${asString(data.id)}::uuid,
          ${asString(data.weekStart)}::date,
          ${asString(data.serverVersion)}::bigint,
          ${asRfc3339Timestamp(data.createdAt)}::timestamptz,
          ${asRfc3339Timestamp(data.updatedAt)}::timestamptz
        )
      `
      for (const item of items) {
        await transaction`
          insert into plan_items (id, weekly_plan_id, date, meal_type, recipe_id, recipe_name_snapshot)
          values (
            ${asString(item.id)}::uuid,
            ${asString(data.id)}::uuid,
            ${asString(item.date)}::date,
            ${asString(item.mealType)},
            ${asString(item.recipeId)}::uuid,
            ${asString(item.recipeNameSnapshot)}
          )
        `
      }
      await insertSyncChange(transaction, change, data)
    })
    const plans = await client<
      Array<{
        id: string
        week_start: string
        server_version: string | bigint
        created_at: Date | string
        updated_at: Date | string
      }>
    >`select id, week_start, server_version, created_at, updated_at from weekly_plans`
    const storedItems = await client<
      Array<{
        id: string
        weekly_plan_id: string
        date: string
        meal_type: 'breakfast' | 'lunch' | 'dinner'
        recipe_id: string
        recipe_name_snapshot: string
      }>
    >`
      select id, weekly_plan_id, date, meal_type, recipe_id, recipe_name_snapshot
      from plan_items
      order by date, case meal_type when 'breakfast' then 1 when 'lunch' then 2 else 3 end
    `
    const plan = plans[0]
    if (plan === undefined) throw new Error('Expected persisted weekly plan')
    expect(
      normalizeRfc3339Timestamps(
        weeklyPlanRowsToContract(
          {
            id: plan.id,
            weekStart: plan.week_start,
            serverVersion: BigInt(plan.server_version),
            createdAt: new Date(plan.created_at),
            updatedAt: new Date(plan.updated_at),
          },
          storedItems.map((item) => ({
            id: item.id,
            weeklyPlanId: item.weekly_plan_id,
            date: item.date,
            mealType: item.meal_type,
            recipeId: item.recipe_id,
            recipeNameSnapshot: item.recipe_name_snapshot,
          })),
        ),
      ),
    ).toEqual(normalizeRfc3339Timestamps(data))
    await expectStoredSyncChange(client, change)
    return
  }

  if (change.resource === 'settings') {
    await client`
      insert into settings (key, value, value_schema_version, server_version)
      values (
        ${asString(data.key)},
        ${JSON.stringify(data)}::jsonb,
        1,
        ${asString(change.serverVersion)}::bigint
      )
    `
    await insertSyncChange(client, change, data)
    const rows = await client<
      Array<{
        key: string
        value: unknown
        value_schema_version: number
      }>
    >`select key, value, value_schema_version from settings`
    const row = rows[0]
    if (row === undefined) throw new Error('Expected persisted settings')
    expect(validateVersionedJsonb('settings.value', row.value_schema_version, row.value)).toEqual(
      data,
    )
    await expectStoredSyncChange(client, change)
    return
  }

  throw new Error(`No PostgreSQL persistence path for fixture ${fixture.id}`)
}

describe('fixture PostgreSQL persistence round-trips', () => {
  it('executes every manifest-declared postgres fixture through PostgreSQL 16', async () => {
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
          fileURLToPath(new URL('../db/migrations/', import.meta.url)),
        ),
      })
      const fixtures = await postgresFixtures()
      const executed = new Map<string, number>()
      for (const fixture of fixtures) {
        const validation = validateContract(fixture.schemaId, fixture.value)
        if (fixture.expected === 'reject') {
          expect(validation.success).toBe(false)
        } else {
          expect(validation.success).toBe(true)
          await persistAndAssertFixture(client, fixture)
        }
        executed.set(fixture.id, (executed.get(fixture.id) ?? 0) + 1)
      }
      expect([...executed.entries()].filter(([, count]) => count !== 1)).toEqual([])
      expect(new Set(executed.keys())).toEqual(new Set(fixtures.map((fixture) => fixture.id)))
    } finally {
      await client.end()
      await container.stop()
    }
  })
})
