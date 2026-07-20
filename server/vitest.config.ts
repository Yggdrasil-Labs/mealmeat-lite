import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Vitest 3.2+ 统一配置 — 使用 test.projects 替代已废弃的 workspace 和独立 config 文件
 *
 * 运行方式:
 *   pnpm test:unit        → vitest run --project unit
 *   pnpm test:integration → vitest run --project integration
 *   pnpm vitest run       → 同时运行两个 project
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['src/**/*.integration.test.ts'],
          testTimeout: 30_000,
        },
      },
    ],
  },
})
