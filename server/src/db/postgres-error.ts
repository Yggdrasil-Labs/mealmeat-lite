/**
 * postgres-js 错误解包 — drizzle 会把 PostgresError 包成 DrizzleQueryError（cause 保留原错误）
 */
import postgres from 'postgres'

export type PostgresError = InstanceType<typeof postgres.PostgresError>

const PostgresError = postgres.PostgresError

export function unwrapPostgresError(err: unknown): PostgresError | null {
  if (err instanceof PostgresError) return err
  const cause = (err as { cause?: unknown } | null)?.cause
  return cause instanceof PostgresError ? cause : null
}
