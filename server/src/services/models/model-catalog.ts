import { readFileSync } from 'node:fs'
import type { ModelListResponse } from '../../contracts/generated/schemas.js'

export interface ConfiguredModel {
  id: string
  displayName: string
  baseURL: string
  model: string
  apiKeyEnv: string
  apiKey: string
  enabled: boolean
  isDefault: boolean
  capabilities: { streaming: boolean; tools: boolean }
}

interface ModelCatalogSource {
  models: unknown
}

export interface ModelCatalogLoadOptions {
  readFile?: () => string
  env?: NodeJS.ProcessEnv
}

/** 只向调用方暴露配置键名，绝不回显目录内容、URL 或凭证。 */
export class ModelCatalogError extends Error {
  constructor() {
    super('Invalid configuration: MEALMATE_MODELS_FILE')
    this.name = 'ModelCatalogError'
  }
}

export class ModelCatalog {
  private constructor(
    private readonly models: readonly ConfiguredModel[],
    private readonly enabledModels: readonly ConfiguredModel[],
  ) {}

  static fromFile(file: string, env: NodeJS.ProcessEnv = process.env): ModelCatalog {
    if (file !== '/run/config/models.json') throw new ModelCatalogError()
    return ModelCatalog.load({ readFile: () => readFileSync(file, 'utf8'), env })
  }

  static load(options: ModelCatalogLoadOptions = {}): ModelCatalog {
    let source: ModelCatalogSource
    try {
      source = JSON.parse(
        (options.readFile ?? (() => readFileSync('/run/config/models.json', 'utf8')))(),
      )
    } catch {
      throw new ModelCatalogError()
    }

    if (!isRecord(source) || !hasOnlyKeys(source, ['models']) || !Array.isArray(source.models)) {
      throw new ModelCatalogError()
    }
    const seen = new Set<string>()
    const configured: ConfiguredModel[] = []
    const enabledModels: ConfiguredModel[] = []
    for (const item of source.models) {
      const model = parseConfiguredModel(item, options.env ?? process.env)
      if (seen.has(model.id)) throw new ModelCatalogError()
      seen.add(model.id)
      if (model.enabled) enabledModels.push(model)
      if (
        model.enabled &&
        model.capabilities.streaming &&
        model.capabilities.tools &&
        model.apiKey !== ''
      ) {
        configured.push(model)
      }
    }
    if (configured.length === 0 || configured.filter((model) => model.isDefault).length !== 1) {
      throw new ModelCatalogError()
    }
    return new ModelCatalog(configured, enabledModels)
  }

  listPublic(): ModelListResponse {
    return {
      items: this.models.map(({ id, displayName, isDefault }) => ({ id, displayName, isDefault })),
    }
  }

  resolveRequested(modelId: string): ConfiguredModel {
    const model = this.models.find((candidate) => candidate.id === modelId)
    if (model === undefined) throw new ModelCatalogError()
    return model
  }

  listEnabled(): readonly ConfiguredModel[] {
    return this.enabledModels
  }
}

function parseConfiguredModel(value: unknown, env: NodeJS.ProcessEnv): ConfiguredModel {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'id',
      'displayName',
      'baseURL',
      'model',
      'apiKeyEnv',
      'enabled',
      'isDefault',
      'capabilities',
    ])
  ) {
    throw new ModelCatalogError()
  }
  const { id, displayName, baseURL, model, apiKeyEnv, enabled, isDefault, capabilities } = value
  if (
    typeof id !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(id) ||
    typeof displayName !== 'string' ||
    displayName === '' ||
    typeof baseURL !== 'string' ||
    !isHttpUrl(baseURL) ||
    typeof model !== 'string' ||
    model === '' ||
    typeof apiKeyEnv !== 'string' ||
    !/^[A-Z_][A-Z0-9_]*$/.test(apiKeyEnv) ||
    typeof enabled !== 'boolean' ||
    typeof isDefault !== 'boolean' ||
    !isCapabilities(capabilities)
  ) {
    throw new ModelCatalogError()
  }
  return {
    id,
    displayName,
    baseURL,
    model,
    apiKeyEnv,
    apiKey: env[apiKeyEnv]?.trim() ?? '',
    enabled,
    isDefault,
    capabilities,
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

function isCapabilities(value: unknown): value is { streaming: boolean; tools: boolean } {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['streaming', 'tools']) &&
    typeof value.streaming === 'boolean' &&
    typeof value.tools === 'boolean'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).every((key) => expected.includes(key))
}
