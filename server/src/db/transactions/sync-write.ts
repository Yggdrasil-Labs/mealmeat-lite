import { type SQL, sql } from 'drizzle-orm'
import type { NewRecipeRow, VersionedRecipeInsertRow } from '../schema/recipes.js'

export type SyncResourceLock =
  | { resource: 'recipe' | 'weekly_plan'; id: string }
  | { resource: 'settings'; id: 'familyPreference' }

export interface SyncWriteTransaction {
  execute(query: SQL): Promise<unknown>
}

export interface Database {
  transaction<T>(work: (tx: SyncWriteTransaction) => Promise<T>): Promise<T>
}

export interface SyncWriteContext {
  tx: SyncWriteTransaction
  nextServerVersion(): Promise<bigint>
}

/** Adds a version only inside an already-locked sync write transaction. */
export async function assignRecipeServerVersion(
  context: Pick<SyncWriteContext, 'nextServerVersion'>,
  row: NewRecipeRow,
): Promise<VersionedRecipeInsertRow> {
  return { ...row, serverVersion: await context.nextServerVersion() }
}

const resourceOrder: Readonly<Record<SyncResourceLock['resource'], number>> = {
  recipe: 0,
  weekly_plan: 1,
  settings: 2,
}

function sortLocks(resourceLocks: readonly SyncResourceLock[]): SyncResourceLock[] {
  return [...resourceLocks].sort(
    (left, right) =>
      resourceOrder[left.resource] - resourceOrder[right.resource] ||
      left.id.localeCompare(right.id),
  )
}

async function lockExistingResource(
  tx: SyncWriteTransaction,
  lock: SyncResourceLock,
): Promise<void> {
  if (lock.resource === 'recipe') {
    await tx.execute(sql`select id from recipes where id = ${lock.id} for update`)
    return
  }
  if (lock.resource === 'weekly_plan') {
    await tx.execute(sql`select id from weekly_plans where id = ${lock.id} for update`)
    return
  }
  await tx.execute(sql`select key from settings where key = ${lock.id} for update`)
}

function versionFrom(result: unknown): bigint {
  const row = Array.isArray(result) ? result[0] : undefined
  const candidate =
    row && typeof row === 'object' ? (row as Record<string, unknown>).version : undefined
  if (
    typeof candidate !== 'string' &&
    typeof candidate !== 'number' &&
    typeof candidate !== 'bigint'
  ) {
    throw new Error('sync_server_version_seq returned no version')
  }
  return BigInt(candidate)
}

/**
 * The only Stage-1 entrypoint permitted to allocate SyncChange versions.
 * The advisory lock serializes creations while row locks protect existing rows.
 */
export async function withSyncWriteTransaction<T>(
  db: Database,
  resourceLocks: readonly SyncResourceLock[],
  work: (context: SyncWriteContext) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('mealmate_sync_write_v1'))`)
    for (const lock of sortLocks(resourceLocks)) await lockExistingResource(tx, lock)

    return work({
      tx,
      async nextServerVersion(): Promise<bigint> {
        return versionFrom(
          await tx.execute(sql`select nextval('sync_server_version_seq') as version`),
        )
      },
    })
  })
}
