/**
 * 配置加载测试 — bootstrap secret 熵编码与 TZ 校验
 */
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ConfigError, loadAppConfig } from './config.js'

const VALID_HEX = 'ab'.repeat(32) // 64 hex chars = 32 bytes
const VALID_B64 = Buffer.alloc(32, 7).toString('base64url') // 43 chars

function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return { TZ: 'Asia/Shanghai', MEALMATE_BOOTSTRAP_SECRET: VALID_HEX, ...overrides }
}

describe('loadAppConfig', () => {
  it('accepts a 64-char hex secret and keeps its original string form', () => {
    const config = loadAppConfig(env())
    expect(config.bootstrapSecret).toBe(VALID_HEX)
  })

  it('accepts a 43-char base64url secret', () => {
    const config = loadAppConfig(env({ MEALMATE_BOOTSTRAP_SECRET: VALID_B64 }))
    expect(config.bootstrapSecret).toBe(VALID_B64)
  })

  it('reads the secret from a file when MEALMATE_BOOTSTRAP_SECRET_FILE is set', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mealmate-config-'))
    const file = join(dir, 'secret')
    writeFileSync(file, VALID_HEX + '\n')
    const config = loadAppConfig(env({ MEALMATE_BOOTSTRAP_SECRET_FILE: file }))
    expect(config.bootstrapSecret).toBe(VALID_HEX)
  })

  it('fails on missing or short secrets', () => {
    expect(() => loadAppConfig(env({ MEALMATE_BOOTSTRAP_SECRET: undefined }))).toThrow(ConfigError)
    expect(() => loadAppConfig(env({ MEALMATE_BOOTSTRAP_SECRET: 'ab' }))).toThrow(ConfigError)
    expect(() => loadAppConfig(env({ MEALMATE_BOOTSTRAP_SECRET: 'ab'.repeat(20) }))).toThrow(
      ConfigError,
    )
  })

  it('rejects placeholder and repeated-character secrets', () => {
    expect(() => loadAppConfig(env({ MEALMATE_BOOTSTRAP_SECRET: 'a'.repeat(64) }))).toThrow(
      ConfigError,
    )
    expect(() =>
      loadAppConfig(env({ MEALMATE_BOOTSTRAP_SECRET: 'example-'.repeat(8).slice(0, 64) })),
    ).toThrow(ConfigError)
  })

  it('fails on a non Asia/Shanghai TZ', () => {
    expect(() => loadAppConfig(env({ TZ: 'UTC' }))).toThrow(ConfigError)
    expect(() => loadAppConfig(env({ TZ: undefined }))).toThrow(ConfigError)
  })
})
