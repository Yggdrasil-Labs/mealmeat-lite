/**
 * Provider 工具投影
 *
 * 从权威 schema 生成 AI Provider 工具定义
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SCHEMA_FILES } from './generated/schemas.js'
import type { ContractManifest } from './types.js'
import { ContractError } from './types.js'

const DEFAULT_SCHEMAS_DIR = join(import.meta.dirname, '../../../contracts/v1/source/schemas')

export interface ProviderToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
    additionalProperties?: boolean
  }
}

export interface BuildProviderToolsOptions {
  /** 自定义 schemas 目录路径，默认使用 contracts/v1/source/schemas */
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

/**
 * 工具输入 schema 位置映射
 *
 * 格式：{ file, defName } 用于从 schema 文件读取 $defs
 *
 * 注意：validation.ts 中有类似的 toolInputSchemas，格式为 { file, defPath }
 * 两者信息相同，但表示方式不同：
 * - toolInputLocations.defName: 'AddRecipeInput' (纯名称)
 * - toolInputSchemas.defPath: '/$defs/AddRecipeInput' (JSON Pointer 格式)
 *
 * TODO: 考虑从 manifest.functionTools 动态派生，避免手工维护两份映射
 */
const toolInputLocations: Record<string, { file: string; defName: string }> = {
  add_recipe: { file: 'recipe.schema.json', defName: 'AddRecipeInput' },
  update_recipe: { file: 'recipe.schema.json', defName: 'UpdateRecipeInput' },
  delete_recipe: { file: 'recipe.schema.json', defName: 'DeleteRecipeInput' },
  restore_recipe: { file: 'recipe.schema.json', defName: 'RestoreRecipeInput' },
  search_recipes: { file: 'recipe.schema.json', defName: 'SearchRecipesInput' },
  batch_generate_recipes: { file: 'recipe.schema.json', defName: 'BatchGenerateRecipesInput' },
  generate_weekly_plan: { file: 'plan.schema.json', defName: 'GenerateWeeklyPlanInput' },
  update_plan_item: { file: 'plan.schema.json', defName: 'UpdatePlanItemInput' },
}

type DefEntry = { schema: Record<string, unknown>; file: string }
type DefsMap = Map<string, DefEntry>

function loadSchemaFile(schemasDir: string, fileName: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(schemasDir, fileName), 'utf-8'))
}

function collectAllDefs(schemasDir: string): DefsMap {
  const allDefs: DefsMap = new Map()
  for (const file of SCHEMA_FILES) {
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
  manifest: ContractManifest,
  options?: BuildProviderToolsOptions,
): readonly ProviderToolDefinition[] {
  const schemasDir = options?.schemasDir ?? DEFAULT_SCHEMAS_DIR
  const allDefs = collectAllDefs(schemasDir)
  const tools: ProviderToolDefinition[] = []

  for (const fc of manifest.functionTools) {
    const loc = toolInputLocations[fc.name]
    if (!loc) throw new ContractError('CONTRACT_UNRESOLVED_REF', `No schema for: ${fc.name}`)

    const schemaFile = loadSchemaFile(schemasDir, loc.file)
    const defs = schemaFile.$defs as Record<string, Record<string, unknown>> | undefined
    const inputSchema = defs?.[loc.defName]
    if (!inputSchema) {
      throw new ContractError('CONTRACT_UNRESOLVED_REF', `Schema not found: ${loc.defName}`)
    }

    const expanded = expandSchema(inputSchema, loc.file, allDefs, new Set())
    tools.push({
      name: fc.name,
      description: fc.description,
      parameters: {
        type: 'object',
        properties: (expanded.properties as Record<string, unknown>) || {},
        required: expanded.required as string[] | undefined,
        additionalProperties: false,
      },
    })
  }
  return tools
}
