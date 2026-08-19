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
const MODELS_JSON = JSON.stringify({
  models: [
    {
      id: 'default',
      displayName: 'Default',
      baseURL: 'https://provider.example/v1',
      model: 'default-1',
      apiKeyEnv: 'MODEL_API_KEY',
      enabled: true,
      isDefault: true,
      capabilities: { streaming: true, tools: true },
    },
  ],
})

function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    TZ: 'Asia/Shanghai',
    MEALMATE_BOOTSTRAP_SECRET: VALID_HEX,
    MEALMATE_MODELS_FILE: '/run/config/models.json',
    MODEL_API_KEY: 'available',
    ...overrides,
  }
}

function load(overrides: Record<string, string | undefined> = {}) {
  return loadAppConfig(env(overrides), () => MODELS_JSON)
}

describe('loadAppConfig', () => {
  it('accepts a 64-char hex secret and keeps its original string form', () => {
    const config = load()
    expect(config.bootstrapSecret).toBe(VALID_HEX)
  })

  it('accepts a 43-char base64url secret', () => {
    const config = load({ MEALMATE_BOOTSTRAP_SECRET: VALID_B64 })
    expect(config.bootstrapSecret).toBe(VALID_B64)
  })

  it('reads the secret from a file when MEALMATE_BOOTSTRAP_SECRET_FILE is set', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mealmate-config-'))
    const file = join(dir, 'secret')
    writeFileSync(file, VALID_HEX + '\n')
    const config = load({ MEALMATE_BOOTSTRAP_SECRET_FILE: file })
    expect(config.bootstrapSecret).toBe(VALID_HEX)
  })

  it('fails on missing or short secrets', () => {
    expect(() => load({ MEALMATE_BOOTSTRAP_SECRET: undefined })).toThrow(ConfigError)
    expect(() => load({ MEALMATE_BOOTSTRAP_SECRET: 'ab' })).toThrow(ConfigError)
    expect(() => load({ MEALMATE_BOOTSTRAP_SECRET: 'ab'.repeat(20) })).toThrow(ConfigError)
  })

  it('rejects placeholder and repeated-character secrets', () => {
    expect(() => load({ MEALMATE_BOOTSTRAP_SECRET: 'a'.repeat(64) })).toThrow(ConfigError)
    expect(() => load({ MEALMATE_BOOTSTRAP_SECRET: 'example-'.repeat(8).slice(0, 64) })).toThrow(
      ConfigError,
    )
  })

  it('fails on a non Asia/Shanghai TZ', () => {
    expect(() => load({ TZ: 'UTC' })).toThrow(ConfigError)
    expect(() => load({ TZ: undefined })).toThrow(ConfigError)
  })

  it('accepts only the container catalog path and statically validates its allowlist', () => {
    const config = loadAppConfig(
      env({ MEALMATE_MODELS_FILE: '/run/config/models.json', MODEL_API_KEY: 'available' }),
      () => MODELS_JSON,
    )

    expect(config.modelCatalog?.listPublic()).toEqual({
      items: [{ id: 'default', displayName: 'Default', isDefault: true }],
    })
    expect(() =>
      loadAppConfig(
        env({ MEALMATE_MODELS_FILE: '/host/models.json', MODEL_API_KEY: 'available' }),
        () => MODELS_JSON,
      ),
    ).toThrow(ConfigError)
  })
})
