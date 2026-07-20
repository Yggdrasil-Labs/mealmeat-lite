import * as path from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createSql } from './utils/db.js'

/**
 * CLI 入口 — 用于 Docker migrate 容器和其他运维命令
 *
 * 用法:
 *   node dist/cli.js db migrate          # 执行数据库迁移
 *   node dist/cli.js models verify        # 验证已配置的 AI 模型
 *   node dist/cli.js auth recovery-reset  # 重置家庭码并撤销全部设备令牌
 */

/**
 * db migrate — 执行数据库迁移，可重复执行（幂等）
 */
async function runMigration(): Promise<void> {
  const sql = createSql()
  const db = drizzle(sql)

  const migrationsFolder = path.join(import.meta.dirname, 'db', 'migrations')

  console.log('[migrate] Running database migrations...')
  console.log(`[migrate] Migrations folder: ${migrationsFolder}`)

  try {
    await migrate(db, { migrationsFolder })
    console.log('[migrate] Migrations complete.')
  } finally {
    await sql.end()
  }
}

/**
 * models verify — 验证已启用的 AI 模型配置
 */
async function runModelVerify(): Promise<void> {
  console.log('[models] Model verification starting...')
  // TODO: 阶段 4 — 对每个 enabled 模型发起流式 no-op tool 探测
  console.log('[models] No models configured yet')
}

/**
 * auth recovery-reset — 生成新家庭码、撤销全部 DeviceToken
 */
function runRecoveryReset(): void {
  // TODO: 阶段 2 — 生成新家庭码、撤销全部 DeviceToken
  console.error('[auth] Recovery reset not yet implemented')
  process.exit(1)
}

// --- 命令路由 ---

const [command, subcommand] = process.argv.slice(2)

async function main(): Promise<void> {
  if (command === 'db' && subcommand === 'migrate') {
    await runMigration()
  } else if (command === 'models' && subcommand === 'verify') {
    await runModelVerify()
  } else if (command === 'auth' && subcommand === 'recovery-reset') {
    runRecoveryReset()
  } else {
    console.error(`Unknown command: ${command} ${subcommand}`)
    console.error('Usage:')
    console.error('  node dist/cli.js db migrate')
    console.error('  node dist/cli.js models verify')
    console.error('  node dist/cli.js auth recovery-reset')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[fatal] CLI command failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
