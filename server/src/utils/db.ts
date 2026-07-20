import * as fs from 'node:fs'
import type { Options } from 'postgres'
import postgres from 'postgres'

/**
 * 读取数据库密码 — 优先 Docker secret 文件，其次环境变量
 *
 * 生产环境通过 Docker secrets 注入 DB_PASSWORD_FILE=/run/secrets/db_password，
 * 本地开发可直接设置 DB_PASSWORD 环境变量。
 */
export function readDbPassword(): string {
  const passwordFile = process.env.DB_PASSWORD_FILE
  if (passwordFile) {
    return fs.readFileSync(passwordFile, 'utf-8').trim()
  }
  const password = process.env.DB_PASSWORD
  if (!password) {
    throw new Error(
      'DB_PASSWORD or DB_PASSWORD_FILE must be set. ' +
        'In production, use Docker secrets with DB_PASSWORD_FILE=/run/secrets/db_password.',
    )
  }
  return password
}

/**
 * 创建 postgres-js 连接 — 默认超时 10s，可通过 options 覆盖
 *
 * 用于 CLI 脚本（migration）和就绪检查等一次性查询。
 * 调用方负责在使用完毕后执行 sql.end() 释放连接。
 */
export function createSql(options?: Options<Record<string, never>>) {
  return postgres({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '5432'),
    user: process.env.DB_USER ?? 'mealmate',
    password: readDbPassword(),
    database: process.env.DB_NAME ?? 'mealmate',
    connect_timeout: 10,
    ...options,
  })
}
