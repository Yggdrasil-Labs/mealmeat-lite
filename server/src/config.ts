/**
 * 运行时配置 — 启动时 fail-fast 校验
 *
 * 只输出"配置项名称 + 是否有效"，不输出值。
 * bootstrap secret 也是 cursor、确认令牌与限流来源键的 HKDF 根密钥，
 * 初始化后必须保持不变（恢复重置不轮换它）。
 */
import { readFileSync } from 'node:fs'

export interface AppConfig {
  /**
   * 部署者配置的 bootstrap secret 原文（trimmed），至少 256 位熵。
   * 保留原文形态：wire 端按同一字符串做常量时间比较，HKDF 派生按 UTF-8 字节执行。
   */
  bootstrapSecret: string
}

export class ConfigError extends Error {
  readonly invalidKeys: readonly string[]

  constructor(invalidKeys: readonly string[]) {
    super(`Invalid configuration: ${invalidKeys.join(', ')}`)
    this.invalidKeys = invalidKeys
  }
}

const PLACEHOLDER_PATTERN = /example|changeme|placeholder|your[-_]?secret/i

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const problems: string[] = []
  const secret = resolveBootstrapSecret(env, problems)
  if (env.TZ !== 'Asia/Shanghai') problems.push('TZ')
  if (problems.length > 0) throw new ConfigError(problems)
  return { bootstrapSecret: secret }
}

/** 失败路径只负责收集 problems（调用方统一抛 ConfigError），返回空串占位。 */
function resolveBootstrapSecret(env: NodeJS.ProcessEnv, problems: string[]): string {
  const file = env.MEALMATE_BOOTSTRAP_SECRET_FILE
  let raw: string | undefined
  if (file) {
    try {
      raw = readFileSync(file, 'utf8').trim()
    } catch {
      problems.push('MEALMATE_BOOTSTRAP_SECRET_FILE')
      return ''
    }
  } else {
    raw = env.MEALMATE_BOOTSTRAP_SECRET?.trim()
  }

  if (!raw || PLACEHOLDER_PATTERN.test(raw) || isRepeatedSingleChar(raw)) {
    problems.push('MEALMATE_BOOTSTRAP_SECRET')
    return ''
  }
  const decoded = decodeEntropy(raw)
  if (!decoded || decoded.length < 32) {
    problems.push('MEALMATE_BOOTSTRAP_SECRET')
    return ''
  }
  return raw
}

function isRepeatedSingleChar(value: string): boolean {
  const first = value[0]
  if (first === undefined) return false
  for (const char of value) if (char !== first) return false
  return true
}

/** 只接受 64+ 位十六进制或 43+ 字符 base64url（解码 ≥ 32 字节）。 */
function decodeEntropy(value: string): Buffer | null {
  if (/^[0-9a-fA-F]{64,}$/.test(value)) return Buffer.from(value, 'hex')
  if (/^[A-Za-z0-9_-]{43,}$/.test(value)) return Buffer.from(value, 'base64url')
  return null
}
