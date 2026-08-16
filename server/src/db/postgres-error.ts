/**
 * postgres-js 错误解包 — drizzle 会把 PostgresError 包成 DrizzleQueryError（cause 保留原错误）
 */
import { PostgresError } from 'postgres'

export function unwrapPostgresError(err: unknown): PostgresError | null {
  if (err instanceof PostgresError) return err
  const cause = (err as { cause?: unknown } | null)?.cause
  return cause instanceof PostgresError ? cause : null
}
