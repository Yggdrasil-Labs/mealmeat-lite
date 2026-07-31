import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { type SQL, sql } from 'drizzle-orm'

export class DatabaseNotReadyError extends Error {
  readonly code = 'NOT_READY'
}

export interface ReadinessDatabase {
  execute(query: SQL): Promise<unknown>
}

function firstNumber(result: unknown): number {
  const row = Array.isArray(result) ? result[0] : undefined
  const value =
    row && typeof row === 'object' ? Object.values(row as Record<string, unknown>)[0] : undefined
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(numeric))
    throw new DatabaseNotReadyError('Readiness query returned no count')
  return numeric
}

async function expectedMigrationHashes(): Promise<readonly string[]> {
  const journal = JSON.parse(
    await readFile(fileURLToPath(new URL('./meta/_journal.json', import.meta.url)), 'utf8'),
  ) as { entries: Array<{ tag: string }> }
  return Promise.all(
    journal.entries.map(async ({ tag }) => {
      const migration = await readFile(fileURLToPath(new URL(`./${tag}.sql`, import.meta.url)))
      return createHash('sha256').update(migration).digest('hex')
    }),
  )
}

function migrationHashes(result: unknown): readonly string[] {
  if (!Array.isArray(result))
    throw new DatabaseNotReadyError('Readiness query returned no migrations')
  const hashes = result.map((row) =>
    row && typeof row === 'object' ? (row as Record<string, unknown>).hash : undefined,
  )
  if (hashes.some((hash) => typeof hash !== 'string'))
    throw new DatabaseNotReadyError('Readiness query returned an invalid migration identity')
  return hashes as string[]
}

const unknownVersionQueries = [
  sql`select count(*) as count from conversations where messages_schema_version <> 1`,
  sql`select count(*) as count from settings where value_schema_version <> 1`,
  sql`select count(*) as count from pending_confirmations where draft_schema_version <> 1 or (result_schema_version is not null and result_schema_version <> 1)`,
  sql`select count(*) as count from chat_request_receipts where tool_receipts_schema_version <> 1`,
  sql`select count(*) as count from sync_action_receipts where result_schema_version <> 1`,
  sql`select count(*) as count from sync_changes where payload_schema_version <> 1`,
] as const

/** Fails closed when migration history or a persisted JSONB version is unknown. */
export async function assertDatabaseSchemaCurrent(db: ReadinessDatabase): Promise<void> {
  try {
    const [expectedHashes, appliedHashes, ...unknownVersions] = await Promise.all([
      expectedMigrationHashes(),
      db
        .execute(sql`select hash from drizzle.__drizzle_migrations order by created_at`)
        .then(migrationHashes),
      ...unknownVersionQueries.map((query) => db.execute(query).then(firstNumber)),
    ])
    if (
      appliedHashes.length !== expectedHashes.length ||
      !expectedHashes.every((hash, index) => hash === appliedHashes[index])
    ) {
      throw new DatabaseNotReadyError(
        `Database migration history mismatch: expected ${expectedHashes.length}, applied ${appliedHashes.length}`,
      )
    }
    if (unknownVersions.some((count) => count > 0)) {
      throw new DatabaseNotReadyError('Database contains an unknown JSONB schema version')
    }
  } catch (error) {
    if (error instanceof DatabaseNotReadyError) throw error
    throw new DatabaseNotReadyError('Database migration history is unavailable')
  }
}
