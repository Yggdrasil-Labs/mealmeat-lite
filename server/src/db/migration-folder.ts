import { realpath } from 'node:fs/promises'

/**
 * Resolves the release pointer exactly once before Drizzle scans migration files.
 * A generation may replace the pointer concurrently, but this caller remains on
 * the complete release it resolved at the start of its migration run.
 */
export async function resolveMigrationsFolder(migrationsPointer: string): Promise<string> {
  return realpath(migrationsPointer)
}
