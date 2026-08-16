import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { GenericContainer, Wait } from 'testcontainers'
import { type AppDeps, createApp } from '../app.js'
import { resolveMigrationsFolder } from '../db/migration-folder.js'
import type { Db } from '../db/pool.js'
import type { PasswordHasher } from '../security/passwords.js'

export interface TestPostgres {
  sql: ReturnType<typeof postgres>
  db: Db
  stop(): Promise<void>
}

/** 从空库执行全部 migration 的真实 PostgreSQL 16 实例。 */
export async function startTestPostgres(): Promise<TestPostgres> {
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
  const sql = postgres({
    host: container.getHost(),
    port: container.getMappedPort(5432),
    user: 'mealmate',
    password: 'test',
    database: 'mealmate',
  })
  await migrate(drizzle(sql), {
    migrationsFolder: await resolveMigrationsFolder(
      fileURLToPath(new URL('../db/migrations/', import.meta.url)),
    ),
  })
  return {
    sql,
    db: drizzle(sql),
    stop: async () => {
      await sql.end()
      await container.stop()
    },
  }
}

/** 64 位十六进制测试 secret，满足 32 字节熵要求。 */
export const TEST_BOOTSTRAP_SECRET = 'cd'.repeat(32)

export interface TestAppOptions {
  source?: string
  hasher?: PasswordHasher
  clock?: () => Date
  /** sync 服务测试屏障：applyAction 读回执前挂起（并发用例用）。 */
  beforeActionReceiptCheck?: () => Promise<void>
}

/** 每个测试使用独立来源地址，保证限流桶互不干扰。 */
export function makeTestApp(pg: TestPostgres, options: TestAppOptions = {}) {
  const deps: AppDeps = {
    getConfig: () => ({ bootstrapSecret: TEST_BOOTSTRAP_SECRET }),
    getDb: () => pg.db,
    resolveSource: () => options.source ?? '203.0.113.7',
    ...(options.hasher === undefined ? {} : { hasher: options.hasher }),
    ...(options.clock === undefined ? {} : { clock: options.clock }),
    ...(options.beforeActionReceiptCheck === undefined
      ? {}
      : { beforeActionReceiptCheck: options.beforeActionReceiptCheck }),
  }
  return createApp(deps)
}

export async function bootstrapDevice(
  app: ReturnType<typeof createApp>,
  deviceName = 'first-device',
  secret = TEST_BOOTSTRAP_SECRET,
): Promise<{ deviceId: string; deviceToken: string; familyCode: string }> {
  const res = await app.request('/api/v1/auth/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bootstrapSecret: secret, deviceName }),
  })
  const body = (await res.json()) as {
    success: boolean
    data: { deviceId: string; deviceToken: string; familyCode: string }
  }
  if (!body.success) throw new Error('bootstrap helper failed: ' + JSON.stringify(body))
  return body.data
}

export function authedPost(
  app: ReturnType<typeof createApp>,
  path: string,
  token: string,
  body?: unknown,
) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

export function authedGet(app: ReturnType<typeof createApp>, path: string, token: string) {
  return app.request(path, {
    headers: { Authorization: 'Bearer ' + token },
  })
}

export function authedDelete(app: ReturnType<typeof createApp>, path: string, token: string) {
  return app.request(path, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
}

export interface EnvelopeBody<T> {
  success: boolean
  data?: T
  errCode?: string
  errMessage?: string
  requestId?: string
  retryable?: boolean
  details?: Array<{ field?: string; reason: string }>
}
