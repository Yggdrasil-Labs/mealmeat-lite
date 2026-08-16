import * as path from 'node:path'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { resolveMigrationsFolder } from './db/migration-folder.js'
import { formatFamilyCode, generateFamilyCode } from './security/crypto.js'
import { argon2Hasher } from './security/passwords.js'
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

  const migrationsPointer = path.join(import.meta.dirname, 'db', 'migrations')
  const migrationsFolder = await resolveMigrationsFolder(migrationsPointer)

  console.log('[migrate] Running database migrations...')
  console.log('[migrate] Migrations release: ' + migrationsFolder)

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
 * auth recovery-reset — 单一事务生成新家庭码、更新 AuthConfig 并撤销全部 DeviceToken。
 * 不修改 Recipe/WeeklyPlan/Settings；成功后只向当前终端输出一次新家庭码。
 */
async function runRecoveryReset(): Promise<void> {
  const sqlClient = createSql()
  const db = drizzle(sqlClient)
  try {
    const familyCode = generateFamilyCode()
    const familyCodeHash = await argon2Hasher.hash(familyCode)
    await db.transaction(async (tx) => {
      const rows = await tx.execute(
        sql`select family_code_version from auth_config where singleton = true for update`,
      )
      const row = (rows as unknown as Array<{ family_code_version: string }>)[0]
      if (row === undefined) {
        throw new Error(
          'instance is not initialized; recovery-reset requires a bootstrapped database',
        )
      }
      await tx.execute(
        sql`update auth_config set family_code_hash = ${familyCodeHash}, family_code_version = family_code_version + 1, updated_at = now() where singleton = true`,
      )
      await tx.execute(sql`update device_tokens set revoked_at = now() where revoked_at is null`)
    })
    console.log(formatFamilyCode(familyCode))
  } finally {
    await sqlClient.end()
  }
}

// --- 命令路由 ---

const [command, subcommand] = process.argv.slice(2)

async function main(): Promise<void> {
  if (command === 'db' && subcommand === 'migrate') {
    await runMigration()
  } else if (command === 'models' && subcommand === 'verify') {
    await runModelVerify()
  } else if (command === 'auth' && subcommand === 'recovery-reset') {
    await runRecoveryReset()
  } else {
    console.error('Unknown command: ' + String(command) + ' ' + String(subcommand))
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
