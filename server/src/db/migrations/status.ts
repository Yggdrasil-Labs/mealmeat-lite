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

async function expectedMigrationCount(): Promise<number> {
  const journal = JSON.parse(
    await readFile(fileURLToPath(new URL('./meta/_journal.json', import.meta.url)), 'utf8'),
  ) as { entries: unknown[] }
  return journal.entries.length
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
    const [migrationCounts, ...unknownVersions] = await Promise.all([
      Promise.all([
        expectedMigrationCount(),
        db
          .execute(sql`select count(*) as count from drizzle.__drizzle_migrations`)
          .then(firstNumber),
      ]),
      ...unknownVersionQueries.map((query) => db.execute(query).then(firstNumber)),
    ])
    const [expected, applied] = migrationCounts
    if (applied !== expected) {
      throw new DatabaseNotReadyError(
        `Database migration history mismatch: expected ${expected}, applied ${applied}`,
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
