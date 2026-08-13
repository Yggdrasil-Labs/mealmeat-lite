/**
 * Provider 工具投影
 *
 * 从权威 schema 生成 AI Provider 工具定义
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { functionTools, publicSchemaMap, schemas } from './generated/schemas.js'
import type { ContractManifest, ContractValidationResult, FunctionToolName } from './types.js'
import { ContractError } from './types.js'
import { validateToolInput } from './validation.js'

export interface ProviderToolDefinition {
  name: FunctionToolName
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
    additionalProperties?: boolean
  }
  /**
   * Provider 的 JSON Schema 只能协助模型生成调用；真正执行前必须重新经过
   * 权威 Ajv validator。将 executor 收口在这里，避免调用点误信 Provider
   * 可能宽松或行为漂移的实现。
   */
  execute<TResult>(
    input: unknown,
    executor: (validatedInput: unknown) => TResult | Promise<TResult>,
  ): Promise<ContractValidationResult<TResult>>
}

export interface BuildProviderToolsOptions {
  /** 显式使用权威 JSON Schema 源目录；省略时使用生成文件内嵌的运行时投影。 */
  schemasDir?: string
}

/**
 * Provider JSONSchema7 投影的危险关键字
 *
 * 这些关键字在 Draft 2020-12 中有效，但在 JSONSchema7（Provider 使用的格式）中
 * 不存在或语义不同，如果出现会导致 Provider 行为不可预测。
 *
 * 与 source-compiler.ts 中的 FORBIDDEN_KEYWORDS（Portable Profile 禁止关键字）
 * 不同：FORBIDDEN_KEYWORDS 禁止权威源使用，DANGEROUS_KEYWORDS 禁止 Provider 投影使用。
 * $vocabulary 只在此处检查，因为它在 Draft 2020-12 中有效但 JSONSchema7 不支持。
 */
const DANGEROUS_KEYWORDS = [
  '$dynamicRef',
  '$dynamicAnchor',
  'unevaluatedItems',
  'unevaluatedProperties',
  '$vocabulary',
]

type DefEntry = { schema: Record<string, unknown>; file: string }
type DefsMap = Map<string, DefEntry>

function loadSchemaFile(schemasDir: string, fileName: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(schemasDir, fileName), 'utf-8'))
}

function schemaFileName(contractFile: string): string {
  if (!contractFile.startsWith('schemas/')) {
    throw new ContractError(
      'CONTRACT_UNRESOLVED_REF',
      `Expected schema source file, got: ${contractFile}`,
    )
  }

  const fileName = contractFile.slice('schemas/'.length)
  if (!fileName.endsWith('.schema.json') || fileName.includes('/')) {
    throw new ContractError('CONTRACT_UNSAFE_PATH', `Unsafe schema source file: ${contractFile}`)
  }

  return fileName
}

function collectAllDefs(schemasDir: string, manifest: Pick<ContractManifest, 'schemas'>): DefsMap {
  const allDefs: DefsMap = new Map()
  const schemaFiles = Array.from(
    new Set(manifest.schemas.map((schema) => schemaFileName(schema.file))),
  ).sort((left, right) => left.localeCompare(right))

  for (const file of schemaFiles) {
    const schema = loadSchemaFile(schemasDir, file)
    const defs = schema.$defs as Record<string, Record<string, unknown>> | undefined
    if (!defs) continue
    for (const [name, def] of Object.entries(defs)) {
      allDefs.set(`${file}#/$defs/${name}`, { schema: def, file })
      allDefs.set(name, { schema: def, file })
    }
  }
  return allDefs
}

/** 检查危险关键字 */
function checkDangerousKeywords(schema: Record<string, unknown>): void {
  for (const kw of DANGEROUS_KEYWORDS) {
    if (kw in schema) {
      throw new ContractError('CONTRACT_PROVIDER_PROJECTION_UNSAFE', `Dangerous keyword "${kw}"`)
    }
  }
}

/** 解析 $ref */
function resolveRef(
  ref: string,
  currentFile: string,
  allDefs: DefsMap,
  visited: Set<string>,
): { entry: DefEntry; key: string } | null {
  const key = ref.startsWith('#/$defs/') ? `${currentFile}${ref}` : ref
  if (visited.has(key)) return null
  visited.add(key)

  const entry = allDefs.get(key) || allDefs.get(key.split('#/$defs/')[1] || '')
  if (!entry) throw new ContractError('CONTRACT_UNRESOLVED_REF', `Cannot resolve: ${ref}`)
  return { entry, key }
}

/** 展开单个值 */
function expandValue(
  value: unknown,
  currentFile: string,
  allDefs: DefsMap,
  visited: Set<string>,
): unknown {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((i) => expandValue(i, currentFile, allDefs, new Set(visited)))
  }
  return expandSchema(value as Record<string, unknown>, currentFile, allDefs, new Set(visited))
}

/** 展开 schema，替换所有 $ref */
function expandSchema(
  schema: Record<string, unknown>,
  currentFile: string,
  allDefs: DefsMap,
  visited: Set<string>,
): Record<string, unknown> {
  checkDangerousKeywords(schema)

  // 处理 $ref
  if ('$ref' in schema && typeof schema.$ref === 'string') {
    const resolved = resolveRef(schema.$ref, currentFile, allDefs, visited)
    if (!resolved) return {}
    const { $ref: _, ...rest } = schema
    const expanded = expandSchema(resolved.entry.schema, resolved.entry.file, allDefs, visited)
    return { ...expanded, ...rest }
  }

  // 递归处理属性
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(schema)) {
    if (k === '$defs') continue
    result[k] = expandValue(v, currentFile, allDefs, visited)
  }
  return result
}

/** 构建 Provider 工具定义 */
export function buildProviderTools(
  manifest: Pick<ContractManifest, 'schemas' | 'functionTools'> = { schemas, functionTools },
  options?: BuildProviderToolsOptions,
): readonly ProviderToolDefinition[] {
  const allDefs = options?.schemasDir
    ? collectAllDefs(options.schemasDir, manifest)
    : new Map<string, DefEntry>()
  const schemaById = new Map(manifest.schemas.map((schema) => [schema.id, schema]))
  const tools: ProviderToolDefinition[] = []

  for (const fc of manifest.functionTools) {
    const schemaDescriptor = schemaById.get(fc.inputSchemaId)
    if (!schemaDescriptor) {
      throw new ContractError(
        'CONTRACT_UNRESOLVED_REF',
        `Tool input schema is not registered: ${fc.name} -> ${fc.inputSchemaId}`,
      )
    }
    const file = options?.schemasDir ? schemaFileName(schemaDescriptor.file) : '<generated>'
    const inputSchema = options?.schemasDir
      ? allDefs.get(`${file}#/$defs/${fc.inputSchemaId}`)?.schema
      : publicSchemaMap[fc.inputSchemaId as keyof typeof publicSchemaMap]
    if (!inputSchema) {
      throw new ContractError('CONTRACT_UNRESOLVED_REF', `Schema not found: ${fc.inputSchemaId}`)
    }

    const expanded = expandSchema(inputSchema, file, allDefs, new Set())
    tools.push({
      name: fc.name,
      description: fc.description,
      parameters: {
        type: 'object',
        properties: (expanded.properties as Record<string, unknown>) || {},
        required: expanded.required as string[] | undefined,
        additionalProperties: false,
      },
      async execute<TResult>(
        input: unknown,
        executor: (validatedInput: unknown) => TResult | Promise<TResult>,
      ): Promise<ContractValidationResult<TResult>> {
        const validation = validateToolInput(fc.name, input)
        if (!validation.success) return validation
        return { success: true, value: await executor(validation.value) }
      },
    })
  }
  return tools
}
