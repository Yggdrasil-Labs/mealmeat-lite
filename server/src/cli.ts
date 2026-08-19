import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { loadAppConfig } from './config.js'
import { resolveMigrationsFolder } from './db/migration-folder.js'
import { formatFamilyCode, generateFamilyCode } from './security/crypto.js'
import { argon2Hasher } from './security/passwords.js'
import type { ConfiguredModel, ModelCatalog } from './services/models/model-catalog.js'
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
export interface ModelVerifyProbeResult {
  delta: string
  toolCall: { name: string; input: unknown }
}

export interface ModelVerifyOptions {
  catalog?: ModelCatalog
  probe?: (model: ConfiguredModel) => Promise<ModelVerifyProbeResult>
  output?: (line: string) => void
  /** 测试可缩短；生产调用始终采用 30 秒。 */
  timeoutMs?: number
}

export function createOpenAICompatibleProbe(
  fetcher: typeof fetch = fetch,
): (model: ConfiguredModel) => Promise<ModelVerifyProbeResult> {
  return async (model) => await probeOpenAICompatibleModel(model, fetcher)
}

/**
 * 发布前的流式工具调用探测。失败输出只包含 model id 与枚举错误类别，绝不记录 URL、密钥或 provider body。
 */
export async function runModelVerify(options: ModelVerifyOptions = {}): Promise<void> {
  const catalog = options.catalog ?? loadAppConfig().modelCatalog
  if (catalog === undefined) throw new Error('MODEL_VERIFY_FAILED')
  const probe = options.probe ?? createOpenAICompatibleProbe()
  const output = options.output ?? console.log
  let failed = false

  for (const model of catalog.listEnabled()) {
    try {
      if (model.apiKey === '') throw new ModelVerifyFailure('MISSING_API_KEY')
      const result = await withTimeout(probe(model), options.timeoutMs ?? 30_000)
      if (result.delta.trim() === '' || !isNoOpToolCall(result.toolCall)) {
        throw new ModelVerifyFailure('INVALID_PROBE')
      }
      output(`[models] ${model.id} pass`)
    } catch (error) {
      failed = true
      output(`[models] ${model.id} fail ${toVerifyCategory(error)}`)
    }
  }
  if (failed) throw new Error('MODEL_VERIFY_FAILED')
}

class ModelVerifyFailure extends Error {
  constructor(readonly category: string) {
    super(category)
  }
}

function isNoOpToolCall(value: { name: string; input: unknown }): boolean {
  return value.name === 'no_op' && isEmptyPlainObject(value.input)
}

function isEmptyPlainObject(value: unknown): value is Record<string, never> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  if (Object.getPrototypeOf(value) !== Object.prototype) return false
  return Object.keys(value).length === 0
}

function toVerifyCategory(error: unknown): string {
  if (error instanceof ModelVerifyFailure) return error.category
  if (error instanceof DOMException && error.name === 'TimeoutError') return 'TIMEOUT'
  return 'PROVIDER_ERROR'
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new ModelVerifyFailure('TIMEOUT')), timeoutMs)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** OpenAI-compatible streaming probe; callers never receive raw provider data. */
async function probeOpenAICompatibleModel(
  model: ConfiguredModel,
  fetcher: typeof fetch,
): Promise<ModelVerifyProbeResult> {
  const response = await fetcher(new URL('chat/completions', ensureTrailingSlash(model.baseURL)), {
    method: 'POST',
    headers: { Authorization: `Bearer ${model.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model.model,
      stream: true,
      messages: [{ role: 'user', content: 'Reply with ok and call the no_op tool once.' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'no_op',
            description: 'Verification no-op.',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
          },
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok || response.body === null) throw new ModelVerifyFailure('PROVIDER_ERROR')

  const state = await readProbeStream(response.body)
  let input: unknown
  try {
    input = JSON.parse(state.toolArguments)
  } catch {
    throw new ModelVerifyFailure('INVALID_PROBE')
  }
  return { delta: state.delta, toolCall: { name: state.toolName, input } }
}

interface ProbeStreamState {
  delta: string
  toolName: string
  toolArguments: string
}

async function readProbeStream(stream: ReadableStream<Uint8Array>): Promise<ProbeStreamState> {
  const state: ProbeStreamState = { delta: '', toolName: '', toolArguments: '' }
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      pending += decoder.decode(chunk.value, { stream: true })
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) addProbeLine(line, state)
    }
    if (pending !== '') addProbeLine(pending, state)
    return state
  } finally {
    reader.releaseLock()
  }
}

function addProbeLine(line: string, state: ProbeStreamState): void {
  if (!line.startsWith('data: ')) return
  const payload = line.slice('data: '.length).trim()
  if (payload === '[DONE]') return
  let delta: Record<string, unknown> | undefined
  try {
    delta = (JSON.parse(payload) as { choices?: Array<{ delta?: Record<string, unknown> }> })
      .choices?.[0]?.delta
  } catch {
    throw new ModelVerifyFailure('PROVIDER_ERROR')
  }
  if (typeof delta?.content === 'string') state.delta += delta.content
  const toolCall = Array.isArray(delta?.tool_calls) ? delta.tool_calls[0] : undefined
  if (typeof toolCall !== 'object' || toolCall === null) return
  const fn = (toolCall as { function?: Record<string, unknown> }).function
  if (typeof fn?.name === 'string') state.toolName = fn.name
  if (typeof fn?.arguments === 'string') state.toolArguments += fn.arguments
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`
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
      // 家庭码已换，旧来源的限流计数不再有意义，一并清空（不属业务数据）
      await tx.execute(sql`delete from auth_attempt_throttles`)
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

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((err) => {
    console.error('[fatal] CLI command failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
}
