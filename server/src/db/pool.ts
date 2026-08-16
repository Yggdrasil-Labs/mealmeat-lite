/**
 * 应用数据库连接池 — 生产限制固定
 *
 * max 10 连接、statement/lock timeout 5 秒、connect timeout 2 秒；
 * 等待全局同步写锁超时的事务完整回滚，由 on-error 映射为 503 SERVICE_BUSY。
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { readDbPassword } from '../utils/db.js'

export function createDbPool(): ReturnType<typeof postgres> {
  return postgres({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '5432'),
    user: process.env.DB_USER ?? 'mealmate',
    password: readDbPassword(),
    database: process.env.DB_NAME ?? 'mealmate',
    max: 10,
    connect_timeout: 2,
    idle_timeout: 30,
    connection: {
      // GUC 原生单位为毫秒；等待全局同步写锁超时的事务完整回滚
      statement_timeout: 5000,
      lock_timeout: 5000,
    },
  })
}

export function createDb(sql = createDbPool()) {
  return drizzle(sql)
}

export type Db = ReturnType<typeof createDb>
