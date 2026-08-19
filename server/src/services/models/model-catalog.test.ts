import { describe, expect, it } from 'vitest'
import { ModelCatalog, ModelCatalogError } from './model-catalog.js'

const catalogJson = JSON.stringify({
  models: [
    {
      id: 'primary',
      displayName: 'Primary model',
      baseURL: 'https://provider.example/v1',
      model: 'primary-1',
      apiKeyEnv: 'PRIMARY_KEY',
      enabled: true,
      isDefault: true,
      capabilities: { streaming: true, tools: true },
    },
    {
      id: 'missing-key',
      displayName: 'Missing key',
      baseURL: 'https://provider.example/v1',
      model: 'secondary-1',
      apiKeyEnv: 'SECONDARY_KEY',
      enabled: true,
      isDefault: false,
      capabilities: { streaming: true, tools: true },
    },
  ],
})

describe('ModelCatalog', () => {
  it('lists only public allowlisted models and resolves only an exact id', () => {
    const catalog = ModelCatalog.load({
      readFile: () => catalogJson,
      env: { PRIMARY_KEY: 'secret-value' },
    })

    expect(catalog.listPublic()).toEqual({
      items: [{ id: 'primary', displayName: 'Primary model', isDefault: true }],
    })
    expect(catalog.resolveRequested('primary')).toMatchObject({
      id: 'primary',
      model: 'primary-1',
    })
    expect(() => catalog.resolveRequested('missing-key')).toThrow(ModelCatalogError)
  })

  it('fails structural validation without including sensitive values in errors', () => {
    expect(() =>
      ModelCatalog.load({
        readFile: () =>
          catalogJson
            .replace('https://provider.example/v1', 'not-a-url')
            .replace('secret-value', 'x'),
        env: { PRIMARY_KEY: 'secret-value' },
      }),
    ).toThrow('MEALMATE_MODELS_FILE')
  })

  it('rejects insecure provider URLs before a credential can be sent', () => {
    expect(() =>
      ModelCatalog.load({
        readFile: () =>
          catalogJson.replace('https://provider.example/v1', 'http://provider.example/v1'),
        env: { PRIMARY_KEY: 'secret-value' },
      }),
    ).toThrow('MEALMATE_MODELS_FILE')
  })

  it('rejects control characters in a model id before it can reach logs', () => {
    const source = JSON.parse(catalogJson) as { models: Array<Record<string, unknown>> }
    const first = source.models[0]
    if (first === undefined) throw new Error('test fixture requires a model')
    first.id = 'unsafe\nmodel'

    expect(() =>
      ModelCatalog.load({
        readFile: () => JSON.stringify(source),
        env: { PRIMARY_KEY: 'secret-value' },
      }),
    ).toThrow('MEALMATE_MODELS_FILE')
  })

  it('rejects unknown directory fields under the strict JSON contract', () => {
    const source = JSON.parse(catalogJson) as { models: Array<Record<string, unknown>> }
    const first = source.models[0]
    if (first === undefined) throw new Error('test fixture requires a model')
    first.unsupported = true

    expect(() =>
      ModelCatalog.load({
        readFile: () => JSON.stringify(source),
        env: { PRIMARY_KEY: 'secret-value' },
      }),
    ).toThrow('MEALMATE_MODELS_FILE')
  })

  it('requires exactly one default in the public allowlist', () => {
    const source = JSON.parse(catalogJson) as { models: Array<Record<string, unknown>> }
    const first = source.models[0]
    if (first === undefined) throw new Error('test fixture requires a model')
    first.isDefault = false
    expect(() =>
      ModelCatalog.load({
        readFile: () => JSON.stringify(source),
        env: { PRIMARY_KEY: 'secret-value' },
      }),
    ).toThrow('MEALMATE_MODELS_FILE')
  })
})
