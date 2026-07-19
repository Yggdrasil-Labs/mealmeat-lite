import { defineConfig } from 'drizzle-kit'

/**
 * Drizzle Kit 配置 — 仅用于本地开发和 migration 生成。
 * 生产环境通过 DB_PASSWORD_FILE Docker secret 注入凭据，不使用此文件的 fallback 值。
 */
export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '5432'),
    user: process.env.DB_USER ?? 'mealmate',
    password: process.env.DB_PASSWORD ?? 'mealmate',
    database: process.env.DB_NAME ?? 'mealmate',
  },
})
