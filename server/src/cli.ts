/**
 * CLI 入口 — 用于 Docker migrate 容器执行数据库迁移
 *
 * 用法: node dist/cli.js db migrate
 *
 * 阶段 1 实现完整 Drizzle migration 执行逻辑；
 * 当前为骨架占位，成功退出以满足 Compose depends_on 条件。
 */

const [command, subcommand] = process.argv.slice(2)

if (command === 'db' && subcommand === 'migrate') {
  console.log('[migrate] Database migration starting...')
  // TODO: 阶段 1 — 连接 DB 并执行 drizzle-orm/postgres-js/migrator
  console.log('[migrate] No migrations to run (schema not yet defined)')
  console.log('[migrate] Done.')
  process.exit(0)
} else if (command === 'models' && subcommand === 'verify') {
  console.log('[models] Model verification starting...')
  // TODO: 阶段 4 — 对每个 enabled 模型发起流式 no-op tool 探测
  console.log('[models] No models configured yet')
  process.exit(0)
} else if (command === 'auth' && subcommand === 'recovery-reset') {
  console.log('[auth] Recovery reset...')
  // TODO: 阶段 2 — 生成新家庭码、撤销全部 DeviceToken
  console.error('[auth] Not yet implemented')
  process.exit(1)
} else {
  console.error(`Unknown command: ${command} ${subcommand}`)
  console.error('Usage:')
  console.error('  node dist/cli.js db migrate')
  console.error('  node dist/cli.js models verify')
  console.error('  node dist/cli.js auth recovery-reset')
  process.exit(1)
}
