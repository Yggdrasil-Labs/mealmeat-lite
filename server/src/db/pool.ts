/**
 * 应用数据库连接池 — 生产限制固定
 *
 * max 10 连接、statement/lock timeout 5 秒、connect timeout 2 秒；
 * 等待全局同步写锁超时的事务完整回滚，由 on-error 映射为 503 SERVICE_BUSY。
 *
 * 文档化偏离：postgres-js 无「池获取（排队等空闲连接）超时」参数，
 * connect_timeout 只覆盖 TCP/握手建连；连接打满时请求排队，
 * 上界由忙连接的 statement_timeout(5s) 间接兜底。阶段 5 容量基线前重评。
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
