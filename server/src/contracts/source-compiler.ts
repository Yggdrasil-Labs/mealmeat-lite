/**
 * 契约源编译器
 *
 * 从 contracts/v1/source/ 解析权威源，生成 manifest 和投影文件
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  ContractError,
  type ContractManifest,
  type FunctionToolDescriptor,
  type GeneratedDiff,
  type InvariantDefinition,
  type OperationDescriptor,
  type PublicErrorDefinition,
  type SchemaDescriptor,
  type SseEventDescriptor,
} from './types.js'

/**
 * 编译契约源文件，生成 manifest 和投影
 */
export async function compileContractSources(
  sourceRoot: string,
  outputRoot: string,
): Promise<ContractManifest> {
  // 1. 读取并解析 OpenAPI 和 schema 文件
  const openApiPath = join(sourceRoot, 'openapi.yaml')
  const openApiContent = await readFile(openApiPath, 'utf-8')

  // 动态导入 yaml（避免顶层 await）
  const yaml = await import('yaml')
  const openApi = yaml.parse(openApiContent)

  // 2. 提取各类描述符
  const schemas = await extractSchemas(sourceRoot, openApi)
  const httpOperations = extractHttpOperations(openApi)
  const functionTools = extractFunctionTools(openApi)
  const sseEvents = extractSseEvents(openApi)
  const errors = extractErrors(openApi)
  const invariants = extractInvariants(openApi)

  // 3. 验证覆盖和引用
  validateCoverage(httpOperations, functionTools, sseEvents)
  validateUniqueIds(schemas, errors, invariants)
  await validateSchemaRefs(sourceRoot, schemas)
  await validatePortableProfile(sourceRoot, schemas)

  // 4. 计算 fingerprint
  const fingerprint = await calculateFingerprint(sourceRoot)

  // 5. 构建 manifest
  const manifest: ContractManifest = {
    contractVersion: 'v1',
    fingerprint,
    httpOperations,
    functionTools,
    sseEvents,
    schemas,
    errors,
    invariants,
  }

  // 6. 写入生成文件
  await mkdir(outputRoot, { recursive: true })
  await writeFile(join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  // 生成 protocol-catalog.json
  const protocolCatalog = {
    errors: errors.map((e) => ({
      errCode: e.errCode,
      httpStatus: e.httpStatus,
      retryable: e.retryable,
      retryAfter: e.retryAfter,
      channels: e.channels,
    })),
    sseEvents: sseEvents.map((e) => ({
      event: e.event,
      isStart: e.isStart,
      isTerminal: e.isTerminal,
    })),
    invariants: invariants.map((i) => ({
      id: i.id,
      appliesTo: i.appliesTo,
      owners: i.owners,
    })),
  }
  await writeFile(
    join(outputRoot, 'protocol-catalog.json'),
    `${JSON.stringify(protocolCatalog, null, 2)}\n`,
  )

  // 生成 provider-tools.json
  // 注意：这需要动态 import 以避免循环依赖
  const { buildProviderTools } = await import('./provider-tools.js')
  const providerTools = buildProviderTools(manifest, { schemasDir: join(sourceRoot, 'schemas') })
  await writeFile(
    join(outputRoot, 'provider-tools.json'),
    `${JSON.stringify({ tools: providerTools }, null, 2)}\n`,
  )

  // 生成增强版 OpenAPI spec (包含 components/schemas)
  // 用于 OpenAPI Generator 生成 Kotlin DTO
  const enhancedOpenApi = await generateEnhancedOpenApi(sourceRoot, openApi, schemas)
  await writeFile(join(outputRoot, 'openapi-with-schemas.yaml'), enhancedOpenApi)

  return manifest
}

/**
 * 检查已提交生成物与源的一致性
 */
export async function checkGeneratedContract(
  sourceRoot: string,
  committedOutputRoot: string,
): Promise<GeneratedDiff> {
  const { mkdtemp, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')

  // 生成到临时目录
  const tempDir = await mkdtemp(join(tmpdir(), 'contract-check-'))

  try {
    await compileContractSources(sourceRoot, tempDir)

    // 比较两个目录
    const tempFiles = await collectFilesWithHashes(tempDir)
    const committedFiles = await collectFilesWithHashes(committedOutputRoot)

    const added: string[] = []
    const modified: string[] = []
    const deleted: string[] = []

    // 检查临时目录中的文件
    for (const [path, hash] of tempFiles) {
      const committedHash = committedFiles.get(path)
      if (committedHash === undefined) {
        added.push(path)
      } else if (hash !== committedHash) {
        modified.push(path)
      }
    }

    // 检查已提交目录中的陈旧文件
    for (const [path] of committedFiles) {
      if (!tempFiles.has(path)) {
        deleted.push(path)
      }
    }

    return {
      hasChanges: added.length > 0 || modified.length > 0 || deleted.length > 0,
      added,
      modified,
      deleted,
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

// ============================================================================
// 内部函数
// ============================================================================

async function extractSchemas(sourceRoot: string, openApi: unknown): Promise<SchemaDescriptor[]> {
  const schemas: SchemaDescriptor[] = []

  // 1. 从 openapi.yaml 的 components.schemas 提取
  const api = openApi as Record<string, unknown>
  const components = api.components as Record<string, unknown> | undefined

  if (components?.schemas) {
    const schemaMap = components.schemas as Record<string, unknown>
    for (const [id, _schema] of Object.entries(schemaMap)) {
      schemas.push({
        id,
        file: 'openapi.yaml',
        dialect: '2020-12',
        public: true,
      })
    }
  }

  // 2. 从 schemas/ 目录提取独立 schema 文件
  const schemasDir = join(sourceRoot, 'schemas')
  try {
    const entries = await readdir(schemasDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.schema.json')) {
        const schemaContent = await readFile(join(schemasDir, entry.name), 'utf-8')
        const schemaJson = JSON.parse(schemaContent) as Record<string, unknown>
        const defs = schemaJson.$defs as Record<string, unknown> | undefined

        if (defs) {
          for (const defId of Object.keys(defs)) {
            schemas.push({
              id: defId,
              file: `schemas/${entry.name}`,
              dialect: '2020-12',
              public: true,
            })
          }
        }
      }
    }
  } catch {
    // schemas 目录不存在时跳过
  }

  return schemas
}

function extractHttpOperations(openApi: unknown): OperationDescriptor[] {
  const operations: OperationDescriptor[] = []
  const api = openApi as Record<string, unknown>
  const paths = api.paths as Record<string, unknown> | undefined

  if (!paths) return operations

  for (const [path, pathItem] of Object.entries(paths)) {
    const item = pathItem as Record<string, unknown>
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const op = item[method] as Record<string, unknown> | undefined
      if (op?.operationId) {
        operations.push({
          operationId: op.operationId as string,
          method: method.toUpperCase() as OperationDescriptor['method'],
          path,
          // TODO(T1-tech-debt): 解析 openapi.yaml 中的 requestBody 和 responses
          // 当前 responses 硬编码为空，意味着 manifest 不记录请求/响应 schema 绑定
          // 影响：T2 下游模块（如 error tuple 校验）无法从 manifest 获取 operation 的响应 schema
          responses: {},
        })
      }
    }
  }

  return operations
}

function extractFunctionTools(openApi: unknown): FunctionToolDescriptor[] {
  const api = openApi as Record<string, unknown>
  const functions = api['x-mealmate-functions'] as FunctionToolDescriptor[] | undefined
  return functions ?? []
}

function extractSseEvents(openApi: unknown): SseEventDescriptor[] {
  const api = openApi as Record<string, unknown>
  const events = api['x-mealmate-sse'] as SseEventDescriptor[] | undefined
  return events ?? []
}

function extractErrors(openApi: unknown): PublicErrorDefinition[] {
  const api = openApi as Record<string, unknown>
  const errors = api['x-mealmate-errors'] as PublicErrorDefinition[] | undefined
  return errors ?? []
}

function extractInvariants(openApi: unknown): InvariantDefinition[] {
  const api = openApi as Record<string, unknown>
  const invariants = api['x-mealmate-invariants'] as InvariantDefinition[] | undefined
  return invariants ?? []
}

function validateCoverage(
  httpOperations: OperationDescriptor[],
  functionTools: FunctionToolDescriptor[],
  sseEvents: SseEventDescriptor[],
): void {
  if (httpOperations.length !== 21) {
    throw new ContractError(
      'CONTRACT_COVERAGE_MISMATCH',
      `Expected 21 HTTP operations, got ${httpOperations.length}`,
    )
  }
  if (functionTools.length !== 8) {
    throw new ContractError(
      'CONTRACT_COVERAGE_MISMATCH',
      `Expected 8 function tools, got ${functionTools.length}`,
    )
  }
  if (sseEvents.length !== 6) {
    throw new ContractError(
      'CONTRACT_COVERAGE_MISMATCH',
      `Expected 6 SSE events, got ${sseEvents.length}`,
    )
  }
}

function validateUniqueIds(
  schemas: SchemaDescriptor[],
  errors: PublicErrorDefinition[],
  invariants: InvariantDefinition[],
): void {
  const schemaIds = schemas.map((s) => s.id)
  const duplicateSchemas = findDuplicates(schemaIds)
  if (duplicateSchemas.length > 0) {
    throw new ContractError(
      'CONTRACT_DUPLICATE_ID',
      `Duplicate schema IDs: ${duplicateSchemas.join(', ')}`,
    )
  }

  const errorCodes = errors.map((e) => e.errCode)
  const duplicateErrors = findDuplicates(errorCodes)
  if (duplicateErrors.length > 0) {
    throw new ContractError(
      'CONTRACT_DUPLICATE_ID',
      `Duplicate error codes: ${duplicateErrors.join(', ')}`,
    )
  }

  const invariantIds = invariants.map((i) => i.id)
  const duplicateInvariants = findDuplicates(invariantIds)
  if (duplicateInvariants.length > 0) {
    throw new ContractError(
      'CONTRACT_DUPLICATE_ID',
      `Duplicate invariant IDs: ${duplicateInvariants.join(', ')}`,
    )
  }
}

function findDuplicates(arr: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const item of arr) {
    if (seen.has(item)) duplicates.add(item)
    seen.add(item)
  }
  return Array.from(duplicates)
}

/**
 * 验证跨文件引用的 fragment 部分
 */
function validateCrossFileFragment(
  fileName: string,
  ref: string,
  filePart: string,
  fragmentPart: string,
  refContent: string,
): void {
  if (!fragmentPart.startsWith('/$defs/')) return

  const defId = fragmentPart.replace('/$defs/', '')
  const refJson = JSON.parse(refContent) as Record<string, unknown>
  const refDefs = refJson.$defs as Record<string, unknown> | undefined

  if (!refDefs || !(defId in refDefs)) {
    throw new ContractError(
      'CONTRACT_UNRESOLVED_REF',
      `Unresolved cross-file reference in ${fileName}: ${ref} (${defId} not found in ${filePart})`,
    )
  }
}

/**
 * 验证跨文件引用
 */
async function validateCrossFileRef(
  schemasDir: string,
  fileName: string,
  ref: string,
  filePart: string,
  fragmentPart: string,
): Promise<void> {
  const refFile = join(schemasDir, filePart)
  const resolvedRefFile = resolve(refFile)
  const resolvedSchemasDir = resolve(schemasDir)

  // 路径遍历防护
  if (!resolvedRefFile.startsWith(resolvedSchemasDir)) {
    throw new ContractError('CONTRACT_UNSAFE_PATH', `Path traversal attempt in ${fileName}: ${ref}`)
  }

  let refContent: string
  try {
    refContent = await readFile(refFile, 'utf-8')
  } catch {
    throw new ContractError(
      'CONTRACT_UNRESOLVED_REF',
      `Unresolved file reference in ${fileName}: ${ref}`,
    )
  }

  // 验证跨文件 fragment 引用
  validateCrossFileFragment(fileName, ref, filePart, fragmentPart, refContent)
}

/**
 * 验证本地 $defs 引用
 */
function validateLocalRef(
  fileName: string,
  ref: string,
  fragmentPart: string,
  content: string,
): void {
  if (!fragmentPart.startsWith('/$defs/')) return

  const defId = fragmentPart.replace('/$defs/', '')
  const schemaJson = JSON.parse(content) as Record<string, unknown>
  const defs = schemaJson.$defs as Record<string, unknown> | undefined

  if (!defs || !(defId in defs)) {
    throw new ContractError(
      'CONTRACT_UNRESOLVED_REF',
      `Unresolved local reference in ${fileName}: ${ref}`,
    )
  }
}

/**
 * 验证单个 schema 文件中的引用
 */
async function validateSchemaFileRefs(
  schemasDir: string,
  fileName: string,
  content: string,
): Promise<void> {
  const refs = extractRefs(content)

  for (const ref of refs) {
    const refParts = ref.split('#')
    const filePart = refParts[0]
    const fragmentPart = refParts[1] || ''

    if (filePart && !filePart.startsWith('http')) {
      // 跨文件引用
      await validateCrossFileRef(schemasDir, fileName, ref, filePart, fragmentPart)
    } else if (!filePart) {
      // 本地引用
      validateLocalRef(fileName, ref, fragmentPart, content)
    }
  }
}

async function validateSchemaRefs(sourceRoot: string, _schemas: SchemaDescriptor[]): Promise<void> {
  const schemasDir = join(sourceRoot, 'schemas')

  try {
    const entries = await readdir(schemasDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.schema.json')) {
        const content = await readFile(join(schemasDir, entry.name), 'utf-8')
        await validateSchemaFileRefs(schemasDir, entry.name, content)
      }
    }
  } catch (err) {
    if (err instanceof ContractError) throw err
    // schemas 目录不存在时跳过
  }
}

/**
 * 从 JSON 内容中提取所有 $ref 值
 */
function extractRefs(jsonContent: string): string[] {
  const refs: string[] = []
  const refRegex = /"\$ref"\s*:\s*"([^"]+)"/g
  for (const match of jsonContent.matchAll(refRegex)) {
    const ref = match[1]
    if (ref) refs.push(ref)
  }
  return refs
}

/**
 * JSON Schema Portable Profile 禁止的关键字
 *
 * 这些关键字在权威源（contracts/v1/source/schemas/）中被禁止使用。
 * 参考：https://json-schema.org/draft/2020-12/json-schema-core.html#section-9.3
 *
 * 与 provider-tools.ts 中的 DANGEROUS_KEYWORDS 关系：
 * - FORBIDDEN_KEYWORDS：在权威源中完全禁止，编译时就会失败
 * - DANGEROUS_KEYWORDS：在 Provider JSONSchema7 投影中禁止，生成工具定义时检查
 *
 * 两者有部分重叠（$dynamicRef, $dynamicAnchor, unevaluatedItems, unevaluatedProperties），
 * 但 DANGEROUS_KEYWORDS 额外包含 $vocabulary（JSONSchema7 不支持），
 * FORBIDDEN_KEYWORDS 额外包含 content* 系列关键字（Portable Profile 限制）。
 */
const FORBIDDEN_KEYWORDS = [
  '$dynamicRef',
  '$dynamicAnchor',
  'unevaluatedItems',
  'unevaluatedProperties',
  'contentEncoding',
  'contentMediaType',
  'contentSchema',
]

async function validatePortableProfile(
  sourceRoot: string,
  _schemas: SchemaDescriptor[],
): Promise<void> {
  const schemasDir = join(sourceRoot, 'schemas')

  try {
    const entries = await readdir(schemasDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.schema.json')) {
        const content = await readFile(join(schemasDir, entry.name), 'utf-8')

        // 检查禁止的关键字
        for (const keyword of FORBIDDEN_KEYWORDS) {
          // 转义 $ 符号用于 regex
          const escapedKeyword = keyword.replace(/\$/g, '\\$')
          const keywordRegex = new RegExp(`"${escapedKeyword}"\\s*:`, 'g')
          if (keywordRegex.test(content)) {
            throw new ContractError(
              'CONTRACT_PROFILE_VIOLATION',
              `Forbidden Portable Profile keyword "${keyword}" found in ${entry.name}`,
            )
          }
        }
      }
    }
  } catch (err) {
    if (err instanceof ContractError) throw err
    // schemas 目录不存在时跳过
  }
}

async function calculateFingerprint(sourceRoot: string): Promise<string> {
  const files = await collectFilesWithHashes(sourceRoot)
  const sortedPaths = Array.from(files.keys()).sort()

  const combined = createHash('sha256')
  for (const path of sortedPaths) {
    combined.update(path)
    const hash = files.get(path)
    if (hash) combined.update(hash)
  }

  return combined.digest('hex')
}

async function collectFilesWithHashes(dir: string): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  try {
    const entries = await readdir(dir, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name))

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        const subFiles = await collectFilesWithHashes(fullPath)
        for (const [subPath, hash] of subFiles) {
          result.set(`${entry.name}/${subPath}`, hash)
        }
      } else if (entry.isFile()) {
        let content = await readFile(fullPath, 'utf-8')
        // 规范化行尾为 LF，确保跨平台确定性
        content = content.replace(/\r\n/g, '\n')
        const hash = createHash('sha256').update(content, 'utf-8').digest('hex')
        result.set(entry.name, hash)
      }
    }
  } catch {
    // 目录不存在时返回空 map
  }

  return result
}

// ============================================================================
// TypeScript Schema 生成
// ============================================================================

/**
 * 需要生成类型的公开 schema
 *
 * 分为两类：
 * 1. schemaLocations: 用于 validateContract
 * 2. toolInputSchemas: 用于 validateToolInput
 */
const PUBLIC_SCHEMAS: Record<string, { file: string; defName: string }> = {
  // validateContract 使用的 schema
  UUID: { file: 'common.schema.json', defName: 'UUID' },
  ServerVersion: { file: 'common.schema.json', defName: 'ServerVersion' },
  Rfc3339DateTime: { file: 'common.schema.json', defName: 'Rfc3339DateTime' },
  MondayDate: { file: 'common.schema.json', defName: 'MondayDate' },
  RecipeView: { file: 'recipe.schema.json', defName: 'RecipeView' },
  RecipeDraft: { file: 'recipe.schema.json', defName: 'RecipeDraft' },
  RecipePatchRequest: { file: 'recipe.schema.json', defName: 'RecipePatchRequest' },
  WeeklyPlanView: { file: 'plan.schema.json', defName: 'WeeklyPlanView' },
}

const TOOL_INPUT_SCHEMAS: Record<string, { file: string; defName: string }> = {
  add_recipe: { file: 'recipe.schema.json', defName: 'AddRecipeInput' },
  update_recipe: { file: 'recipe.schema.json', defName: 'UpdateRecipeInput' },
  delete_recipe: { file: 'recipe.schema.json', defName: 'DeleteRecipeInput' },
  restore_recipe: { file: 'recipe.schema.json', defName: 'RestoreRecipeInput' },
  search_recipes: { file: 'recipe.schema.json', defName: 'SearchRecipesInput' },
  batch_generate_recipes: { file: 'recipe.schema.json', defName: 'BatchGenerateRecipesInput' },
  generate_weekly_plan: { file: 'plan.schema.json', defName: 'GenerateWeeklyPlanInput' },
  update_plan_item: { file: 'plan.schema.json', defName: 'UpdatePlanItemInput' },
}

const SCHEMA_FILES = [
  'common.schema.json',
  'auth.schema.json',
  'recipe.schema.json',
  'plan.schema.json',
  'chat.schema.json',
  'sync.schema.json',
  'settings.schema.json',
] as const

type DefEntry = { schema: Record<string, unknown>; file: string }
type DefsMap = Map<string, DefEntry>

/**
 * 收集所有 schema 定义
 */
function collectAllDefs(schemasDir: string): DefsMap {
  const allDefs: DefsMap = new Map()
  for (const file of SCHEMA_FILES) {
    const content = readFileSync(join(schemasDir, file), 'utf-8')
    const schema = JSON.parse(content) as Record<string, unknown>
    const defs = schema.$defs as Record<string, Record<string, unknown>> | undefined
    if (!defs) continue
    for (const [name, def] of Object.entries(defs)) {
      allDefs.set(`${file}#/$defs/${name}`, { schema: def, file })
      allDefs.set(name, { schema: def, file })
    }
  }
  return allDefs
}

/**
 * 解析 $ref 引用
 */
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

/**
 * 展开 schema 中的值
 */
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
  return expandSchemaForTypes(
    value as Record<string, unknown>,
    currentFile,
    allDefs,
    new Set(visited),
  )
}

/**
 * 展开 schema，替换所有 $ref（用于类型生成）
 *
 * 与 provider-tools.ts 中的 expandSchema 不同，这里不检查 DANGEROUS_KEYWORDS，
 * 因为类型生成不受 JSONSchema7 限制
 */
function expandSchemaForTypes(
  schema: Record<string, unknown>,
  currentFile: string,
  allDefs: DefsMap,
  visited: Set<string>,
): Record<string, unknown> {
  // 处理 $ref
  if ('$ref' in schema && typeof schema.$ref === 'string') {
    const resolved = resolveRef(schema.$ref, currentFile, allDefs, visited)
    if (!resolved) return {}
    const { $ref: _, ...rest } = schema
    const expanded = expandSchemaForTypes(
      resolved.entry.schema,
      resolved.entry.file,
      allDefs,
      visited,
    )
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

/**
 * 生成 TypeScript schema 常量和类型文件
 *
 * 按照 Design 要求：
 * 1. 为每个公开 schema 输出完全展开、只读的 `as const` 常量
 * 2. 使用 `FromSchema<typeof DereferencedSchema>` 推导类型
 * 3. 定义 ContractType 和 ToolInput 类型映射
 */
export async function generateTypeScriptSchemas(
  schemasDir: string,
  outputPath: string,
): Promise<void> {
  const allDefs = collectAllDefs(schemasDir)

  const lines: string[] = [
    '/**',
    ' * Schema 常量与类型 - 由 compile.ts 生成，禁止手改',
    ' * @generated',
    ' */',
    '',
    "import type { FromSchema } from 'json-schema-to-ts'",
    "import manifest from '../../../../contracts/v1/generated/manifest.json' with { type: 'json' }",
    '',
    '// ============================================================================',
    '// Schema 文件列表',
    '// ============================================================================',
    '',
    'export const SCHEMA_FILES = [',
  ]

  for (const file of SCHEMA_FILES) {
    lines.push(`  '${file}',`)
  }
  lines.push('] as const')
  lines.push('')
  lines.push('export type SchemaFileName = (typeof SCHEMA_FILES)[number]')
  lines.push('')

  // 生成 manifest re-exports
  lines.push('// ============================================================================')
  lines.push('// Manifest Re-exports')
  lines.push('// ============================================================================')
  lines.push('')
  lines.push('export const schemas = manifest.schemas')
  lines.push('export const PUBLIC_SCHEMA_IDS = schemas.filter((s) => s.public).map((s) => s.id)')
  lines.push('export const FUNCTION_TOOL_NAMES = manifest.functionTools.map((f) => f.name)')
  lines.push(
    'export const functionToolMap = new Map(manifest.functionTools.map((f) => [f.name, f]))',
  )
  lines.push('export const schemaFileMap = new Map(schemas.map((s) => [s.id, s.file]))')
  lines.push('')

  // 生成公开 schema 常量
  lines.push('// ============================================================================')
  lines.push('// 展开的 Schema 常量 (as const)')
  lines.push('// ============================================================================')
  lines.push('')

  for (const [schemaId, loc] of Object.entries(PUBLIC_SCHEMAS)) {
    const entry = allDefs.get(`${loc.file}#/$defs/${loc.defName}`)
    if (!entry) {
      throw new ContractError('CONTRACT_UNRESOLVED_REF', `Schema not found: ${schemaId}`)
    }
    const expanded = expandSchemaForTypes(entry.schema, entry.file, allDefs, new Set())
    lines.push(`export const ${schemaId}Schema = ${JSON.stringify(expanded, null, 2)} as const`)
    lines.push('')
  }

  // 生成工具输入 schema 常量
  lines.push('// ============================================================================')
  lines.push('// 工具输入 Schema 常量 (as const)')
  lines.push('// ============================================================================')
  lines.push('')

  for (const [toolName, loc] of Object.entries(TOOL_INPUT_SCHEMAS)) {
    const entry = allDefs.get(`${loc.file}#/$defs/${loc.defName}`)
    if (!entry) {
      throw new ContractError('CONTRACT_UNRESOLVED_REF', `Tool input schema not found: ${toolName}`)
    }
    const expanded = expandSchemaForTypes(entry.schema, entry.file, allDefs, new Set())
    const constName = `${loc.defName}Schema`
    lines.push(`export const ${constName} = ${JSON.stringify(expanded, null, 2)} as const`)
    lines.push('')
  }

  // 生成 FromSchema 类型
  lines.push('// ============================================================================')
  lines.push('// FromSchema 类型推导')
  lines.push('// ============================================================================')
  lines.push('')

  for (const schemaId of Object.keys(PUBLIC_SCHEMAS)) {
    lines.push(`export type ${schemaId} = FromSchema<typeof ${schemaId}Schema>`)
  }
  lines.push('')

  for (const [_toolName, loc] of Object.entries(TOOL_INPUT_SCHEMAS)) {
    lines.push(`export type ${loc.defName} = FromSchema<typeof ${loc.defName}Schema>`)
  }
  lines.push('')

  // 生成 ContractType 映射
  lines.push('// ============================================================================')
  lines.push('// 类型映射')
  lines.push('// ============================================================================')
  lines.push('')
  lines.push('/** PublicSchemaId 类型 */')
  const schemaIds = Object.keys(PUBLIC_SCHEMAS)
  lines.push(`export type PublicSchemaId = ${schemaIds.map((id) => `'${id}'`).join(' | ')}`)
  lines.push('')

  lines.push('/** FunctionToolName 类型 */')
  const toolNames = Object.keys(TOOL_INPUT_SCHEMAS)
  lines.push(`export type FunctionToolName = ${toolNames.map((name) => `'${name}'`).join(' | ')}`)
  lines.push('')

  lines.push('/** ContractType - 根据 schema ID 获取类型 */')
  lines.push('export type ContractType<T extends PublicSchemaId> = {')
  for (const schemaId of schemaIds) {
    lines.push(`  ${schemaId}: ${schemaId}`)
  }
  lines.push('}[T]')
  lines.push('')

  lines.push('/** ToolInput - 根据工具名获取输入类型 */')
  lines.push('export type ToolInput<T extends FunctionToolName> = {')
  for (const [toolName, loc] of Object.entries(TOOL_INPUT_SCHEMAS)) {
    lines.push(`  ${toolName}: ${loc.defName}`)
  }
  lines.push('}[T]')
  lines.push('')

  // 写入文件
  await writeFile(outputPath, `${lines.join('\n')}\n`)
}

/**
 * 生成 Ajv standalone validators
 *
 * 按照 Design 要求：使用 Ajv 2020 standalone 生成纯 ESM validator
 */
export async function generateStandaloneValidators(
  schemasDir: string,
  outputPath: string,
): Promise<void> {
  // 动态导入 Ajv 2020-12 和 standalone
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ajv2020Module = (await import('ajv/dist/2020.js')) as any
  const Ajv2020 = Ajv2020Module.Ajv2020 || Ajv2020Module.default
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addFormatsModule = (await import('ajv-formats')) as any
  const addFormats = addFormatsModule.default || addFormatsModule
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const standaloneModule = (await import('ajv/dist/standalone/index.js')) as any
  const standaloneCode = standaloneModule.default || standaloneModule

  // 创建 Ajv 2020-12 实例（与运行时配置相同）
  const ajv = new Ajv2020({
    strict: true,
    strictSchema: true,
    strictNumbers: true,
    strictTypes: true,
    strictTuples: true,
    strictRequired: true,
    allowUnionTypes: true,
    allErrors: true,
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false,
    code: { source: true, esm: true },
  })

  addFormats(ajv)

  // 加载所有 schema
  for (const file of SCHEMA_FILES) {
    const content = readFileSync(join(schemasDir, file), 'utf-8')
    const schema = JSON.parse(content) as Record<string, unknown>
    ajv.addSchema({ ...schema, $id: file })
  }

  // 收集需要编译的 validator 引用
  const validatorRefs: Record<string, string> = {}

  // 公开 schema validators
  for (const [schemaId, loc] of Object.entries(PUBLIC_SCHEMAS)) {
    const ref = `${loc.file}#/$defs/${loc.defName}`
    const funcName = `validate${schemaId}`
    ajv.compile({ $ref: ref })
    validatorRefs[funcName] = ref
  }

  // 工具输入 validators
  for (const [_toolName, loc] of Object.entries(TOOL_INPUT_SCHEMAS)) {
    const ref = `${loc.file}#/$defs/${loc.defName}`
    const funcName = `validate${loc.defName}`
    // 跳过已存在的（RecipeDraft 等可能重复）
    if (!validatorRefs[funcName]) {
      ajv.compile({ $ref: ref })
      validatorRefs[funcName] = ref
    }
  }

  // 生成 standalone 代码
  const code = standaloneCode(ajv, validatorRefs)

  // 生成 TypeScript 包装文件
  const lines: string[] = [
    '/**',
    ' * Ajv Standalone Validators - 由 compile.ts 生成，禁止手改',
    ' * @generated',
    ' *',
    ' * 使用 Ajv 2020 standalone 预编译，运行时不需要 Ajv 库',
    ' */',
    '',
    '/* eslint-disable */',
    '// @ts-nocheck',
    '',
    code,
    '',
    '// ============================================================================',
    '// Validator 查找接口',
    '// ============================================================================',
    '',
    'import type { ErrorObject } from "ajv"',
    '',
    '/** Ajv ValidateFunction 类型 */',
    'export interface ValidateFunction {',
    '  (data: unknown): boolean',
    '  errors?: ErrorObject[] | null',
    '}',
    '',
    '/** Schema 位置到 validator 函数的映射 */',
    'const validatorMap: Record<string, ValidateFunction> = {',
  ]

  // 公开 schema 映射
  for (const [schemaId, loc] of Object.entries(PUBLIC_SCHEMAS)) {
    const key = `${loc.file}#/$defs/${loc.defName}`
    const funcName = `validate${schemaId}`
    lines.push(`  '${key}': ${funcName},`)
  }

  // 工具输入映射
  for (const [_toolName, loc] of Object.entries(TOOL_INPUT_SCHEMAS)) {
    const key = `${loc.file}#/$defs/${loc.defName}`
    const funcName = `validate${loc.defName}`
    lines.push(`  '${key}': ${funcName},`)
  }

  lines.push('}')
  lines.push('')
  lines.push('/**')
  lines.push(' * 获取预编译的 validator')
  lines.push(' */')
  lines.push('export function getValidator(file: string, defPath: string): ValidateFunction {')
  lines.push('  const key = `${file}#${defPath}`')
  lines.push('  const validator = validatorMap[key]')
  lines.push('  if (!validator) throw new Error(`No validator for: ${key}`)')
  lines.push('  return validator')
  lines.push('}')
  lines.push('')

  await writeFile(outputPath, `${lines.join('\n')}\n`)
}

/**
 * 生成增强版 OpenAPI spec (包含 components/schemas)
 *
 * 将独立的 JSON Schema 文件内联到 OpenAPI spec 的 components/schemas 中，
 * 使 OpenAPI Generator 能够生成 Kotlin/Swift 等语言的 DTO。
 */
async function generateEnhancedOpenApi(
  sourceRoot: string,
  originalOpenApi: unknown,
  schemas: readonly SchemaDescriptor[],
): Promise<string> {
  const yaml = await import('yaml')

  // 深拷贝原始 OpenAPI
  const enhanced = JSON.parse(JSON.stringify(originalOpenApi)) as Record<string, unknown>

  // 确保 components 存在
  if (!enhanced.components) {
    enhanced.components = {}
  }
  const components = enhanced.components as Record<string, unknown>

  // 确保 schemas 存在
  if (!components.schemas) {
    components.schemas = {}
  }
  const schemasMap = components.schemas as Record<string, unknown>

  // 加载所有 schema 文件并提取 $defs
  const schemaFiles = new Set(
    schemas.filter((s) => s.file.startsWith('schemas/')).map((s) => s.file),
  )

  for (const file of schemaFiles) {
    const filePath = join(sourceRoot, file)
    const content = await readFile(filePath, 'utf-8')
    const schemaJson = JSON.parse(content) as Record<string, unknown>
    const defs = schemaJson.$defs as Record<string, unknown> | undefined

    if (defs) {
      for (const [defName, defSchema] of Object.entries(defs)) {
        // 内联 schema，移除 $schema 和 $id 等顶级属性
        const inlinedSchema = { ...defSchema } as Record<string, unknown>

        // 转换 $ref 引用：将文件相对引用转为 OpenAPI 内部引用
        // 例如：common.schema.json#/$defs/UUID -> #/components/schemas/UUID
        rewriteRefs(inlinedSchema)

        schemasMap[defName] = inlinedSchema
      }
    }
  }

  // 生成 YAML
  return yaml.stringify(enhanced, {
    indent: 2,
    lineWidth: 120,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
  })
}

/**
 * 递归重写 $ref 引用
 *
 * 将所有 $ref 转换为 OpenAPI components/schemas 引用：
 * - `common.schema.json#/$defs/UUID` -> `#/components/schemas/UUID`
 * - `#/$defs/RecipeView` -> `#/components/schemas/RecipeView`
 */
function rewriteRefs(obj: unknown): void {
  if (obj === null || typeof obj !== 'object') {
    return
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      rewriteRefs(item)
    }
    return
  }

  const record = obj as Record<string, unknown>

  // 处理 $ref
  if (typeof record.$ref === 'string') {
    const ref = record.$ref

    // 匹配 xxx.schema.json#/$defs/YYY 格式 (跨文件引用)
    const crossFileMatch = ref.match(/^[^#]+\.schema\.json#\/\$defs\/(.+)$/)
    if (crossFileMatch) {
      record.$ref = `#/components/schemas/${crossFileMatch[1]}`
    } else {
      // 匹配 #/$defs/YYY 格式 (文件内引用)
      const localMatch = ref.match(/^#\/\$defs\/(.+)$/)
      if (localMatch) {
        record.$ref = `#/components/schemas/${localMatch[1]}`
      }
    }
  }

  // 递归处理子对象
  for (const value of Object.values(record)) {
    rewriteRefs(value)
  }
}

// Re-export types for convenience
export type { ContractManifest, GeneratedDiff } from './types.js'
