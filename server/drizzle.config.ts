import { defineConfig } from 'drizzle-kit'

/**
 * Drizzle Kit 配置 — 仅用于本地开发和 migration 生成。
 * 生产环境通过 DB_PASSWORD_FILE Docker secret 注入凭据。
 *
 * 运行 drizzle-kit 前需设置 DB_PASSWORD 环境变量；
 * 未设置时会以空密码尝试连接，由 PostgreSQL 返回认证错误。
 */
export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '5432'),
    user: process.env.DB_USER ?? 'mealmate',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'mealmate',
  },
})

// 运行时校验：确保 DB_PASSWORD 已设置（drizzle-kit 需要真实密码连接数据库）
if (!process.env.DB_PASSWORD) {
  console.error(
    '[drizzle-kit] DB_PASSWORD is not set. ' +
      'Set the DB_PASSWORD environment variable before running drizzle-kit commands.',
  )
  process.exit(1)
}
