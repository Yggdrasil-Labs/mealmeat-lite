/**
 * 契约源编译器
 *
 * 从 contracts/v1/source/ 解析权威源，生成 manifest 和投影文件
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { mkdir, readdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { ValidateFunction } from 'ajv'
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

const CONTRACT_META_SCHEMA_URL = new URL(
  '../../../contracts/meta/mealmate-contract-meta.schema.json',
  import.meta.url,
)

type Ajv2020Constructor = new (options: {
  allErrors: boolean
  strict: boolean
}) => {
  compile(schema: Record<string, unknown>): ValidateFunction
}

type StandaloneAjv = {
  addSchema(schema: unknown): void
  compile(schema: unknown): unknown
}

type StandaloneAjvConstructor = new (options: Record<string, unknown>) => StandaloneAjv
type AddFormatsInstaller = (ajv: StandaloneAjv) => void
type StandaloneCodeGenerator = (ajv: StandaloneAjv, refs: Record<string, string>) => string

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
  await validateContractMetadata(openApi)

  // 2. 提取各类描述符
  const schemas = await extractSchemas(sourceRoot, openApi)
  const functionTools = extractFunctionTools(openApi)
  const sseEvents = extractSseEvents(openApi)
  const errors = extractErrors(openApi)
  const invariants = extractInvariants(openApi)

  // 3. 验证覆盖和引用
  await validateSchemaRefs(sourceRoot, schemas)
  await validatePortableProfile(sourceRoot, schemas)
  validateSourceUniqueIds(schemas, errors, invariants)

  const httpOperations = extractHttpOperations(openApi, schemas)
  validateCoverage(httpOperations, functionTools, sseEvents)
  validateOperationAndProtocolUniqueIds(httpOperations, functionTools, sseEvents)
  validateSchemaBindings(schemas, httpOperations, functionTools, sseEvents, invariants)

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
    sseEvents,
    invariants: invariants.map((i) => ({
      id: i.id,
      appliesTo: i.appliesTo,
      owners: i.owners,
      vectors: i.vectors,
    })),
  }
  await writeFile(
    join(outputRoot, 'protocol-catalog.json'),
    `${JSON.stringify(protocolCatalog, null, 2)}\n`,
  )

  // 生成 Android 消费的协议目录。Android 只解释这份投影，不在 Kotlin 中复制事件、
  // 转移或不变量事实。
  await generateKotlinProtocolCatalog(sourceRoot, outputRoot, manifest)

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

/**
 * 用版本化的元 schema 验证 OpenAPI 中的 x-mealmate-* 目录。
 *
 * 这些扩展会直接驱动 provider、SSE 和跨端不变量投影；不能等到后续生成器
 * 对错误类型的偶然访问时才暴露格式错误。
 */
async function validateContractMetadata(openApi: unknown): Promise<void> {
  try {
    const metaSchema = JSON.parse(await readFile(CONTRACT_META_SCHEMA_URL, 'utf-8')) as Record<
      string,
      unknown
    >
    const Ajv2020Module = (await import('ajv/dist/2020.js')) as unknown as {
      Ajv2020?: Ajv2020Constructor
      default?: Ajv2020Constructor
    }
    const Ajv2020 = Ajv2020Module.Ajv2020 ?? Ajv2020Module.default
    if (!Ajv2020) {
      throw new ContractError('CONTRACT_META_INVALID', 'Ajv 2020 metadata validator is unavailable')
    }
    const ajv = new Ajv2020({ allErrors: true, strict: true })
    const validate = ajv.compile(metaSchema)

    if (validate(openApi)) return

    const details = (validate.errors ?? []).map((error) => ({
      instancePath: error.instancePath,
      keyword: error.keyword,
      message: error.message,
      schemaPath: error.schemaPath,
    }))
    throw new ContractError(
      'CONTRACT_META_INVALID',
      'OpenAPI x-mealmate metadata does not match the contract meta schema',
      { errors: details },
    )
  } catch (error) {
    if (error instanceof ContractError) throw error

    const message = error instanceof Error ? error.message : String(error)
    throw new ContractError(
      'CONTRACT_META_INVALID',
      `Unable to validate contract metadata: ${message}`,
    )
  }
}

async function extractSchemas(sourceRoot: string, openApi: unknown): Promise<SchemaDescriptor[]> {
  const schemas: SchemaDescriptor[] = []

  // 1. 从 openapi.yaml 的 components.schemas 提取
  const api = openApi as Record<string, unknown>
  const components = api.components as Record<string, unknown> | undefined

  if (components?.schemas) {
    const schemaMap = components.schemas as Record<string, unknown>
    for (const id of Object.keys(schemaMap).sort((left, right) => left.localeCompare(right))) {
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
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.schema.json')) {
        const schemaContent = await readFile(join(schemasDir, entry.name), 'utf-8')
        const schemaJson = JSON.parse(schemaContent) as Record<string, unknown>
        const defs = schemaJson.$defs as Record<string, unknown> | undefined

        if (defs) {
          for (const defId of Object.keys(defs).sort((left, right) => left.localeCompare(right))) {
            const definition = defs[defId]
            schemas.push({
              id: defId,
              file: `schemas/${entry.name}`,
              dialect: '2020-12',
              public: isPublicSchemaDefinition(definition),
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

type RecordValue = Record<string, unknown>

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isPublicSchemaDefinition(value: unknown): boolean {
  return !isRecord(value) || value.$comment !== 'mealmate:public=false'
}

function requireRecord(value: unknown, context: string): RecordValue {
  if (!isRecord(value)) {
    throw new ContractError('CONTRACT_UNRESOLVED_REF', `Expected object at ${context}`)
  }
  return value
}

function extractSchemaIdFromOpenApiReference(
  schema: unknown,
  schemas: readonly SchemaDescriptor[],
  context: string,
): string {
  const schemaRecord = requireRecord(schema, context)
  const ref = schemaRecord.$ref
  if (typeof ref !== 'string') {
    throw new ContractError('CONTRACT_UNRESOLVED_REF', `Expected a schema $ref at ${context}`)
  }

  const externalMatch = ref.match(/^(schemas\/[^#]+\.schema\.json)#\/\$defs\/([^/]+)$/)
  const componentMatch = ref.match(/^#\/components\/schemas\/([^/]+)$/)
  const localDefinitionMatch = ref.match(/^#\/\$defs\/([^/]+)$/)
  const schemaId = externalMatch?.[2] ?? componentMatch?.[1] ?? localDefinitionMatch?.[1]
  const expectedFile = externalMatch?.[1]

  if (!schemaId) {
    throw new ContractError(
      'CONTRACT_UNRESOLVED_REF',
      `Unsupported schema reference at ${context}: ${ref}`,
    )
  }

  const registered = schemas.some(
    (candidate) => candidate.id === schemaId && (!expectedFile || candidate.file === expectedFile),
  )
  if (!registered) {
    throw new ContractError(
      'CONTRACT_UNRESOLVED_REF',
      `Unregistered schema reference at ${context}: ${ref}`,
    )
  }

  return schemaId
}

function extractRequestSchemaId(
  operation: RecordValue,
  schemas: readonly SchemaDescriptor[],
  context: string,
): string | undefined {
  if (!operation.requestBody) return undefined

  const requestBody = requireRecord(operation.requestBody, `${context}.requestBody`)
  const content = requireRecord(requestBody.content, `${context}.requestBody.content`)
  const jsonContent = requireRecord(
    content['application/json'],
    `${context}.requestBody.content.application/json`,
  )

  return extractSchemaIdFromOpenApiReference(
    jsonContent.schema,
    schemas,
    `${context}.requestBody.content.application/json.schema`,
  )
}

function extractResponseSchemas(
  operation: RecordValue,
  schemas: readonly SchemaDescriptor[],
  context: string,
): Record<number, string | null> {
  const responses = requireRecord(operation.responses, `${context}.responses`)
  const responseSchemas: Record<number, string | null> = {}

  for (const [statusText, responseValue] of Object.entries(responses)) {
    const status = Number(statusText)
    if (!Number.isInteger(status) || status < 100 || status > 599) {
      throw new ContractError(
        'CONTRACT_UNRESOLVED_REF',
        `Invalid response status at ${context}: ${statusText}`,
      )
    }

    const response = requireRecord(responseValue, `${context}.responses.${statusText}`)
    const content = requireRecord(response.content, `${context}.responses.${statusText}.content`)

    if (content['application/json']) {
      const jsonContent = requireRecord(
        content['application/json'],
        `${context}.responses.${statusText}.content.application/json`,
      )
      responseSchemas[status] = extractSchemaIdFromOpenApiReference(
        jsonContent.schema,
        schemas,
        `${context}.responses.${statusText}.content.application/json.schema`,
      )
      continue
    }

    if (content['text/event-stream']) {
      // SSE 是由 x-mealmate-sse 清单逐帧描述的流，不伪造为一个 JSON 响应 schema。
      responseSchemas[status] = null
      continue
    }

    throw new ContractError(
      'CONTRACT_UNRESOLVED_REF',
      `Expected application/json or text/event-stream response content at ${context}.responses.${statusText}`,
    )
  }

  return responseSchemas
}

function extractHttpOperations(
  openApi: unknown,
  schemas: readonly SchemaDescriptor[],
): OperationDescriptor[] {
  const operations: OperationDescriptor[] = []
  const api = requireRecord(openApi, 'openapi')
  const paths = api.paths as Record<string, unknown> | undefined

  if (!paths) return operations

  for (const [path, pathItem] of Object.entries(paths)) {
    const item = requireRecord(pathItem, `paths.${path}`)
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const op = item[method]
      if (isRecord(op) && typeof op.operationId === 'string') {
        const context = `${method.toUpperCase()} ${path}`
        const requestSchemaId = extractRequestSchemaId(op, schemas, context)
        operations.push({
          operationId: op.operationId,
          method: method.toUpperCase() as OperationDescriptor['method'],
          path,
          ...(requestSchemaId ? { requestSchemaId } : {}),
          responses: extractResponseSchemas(op, schemas, context),
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

function validateSourceUniqueIds(
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

function validateOperationAndProtocolUniqueIds(
  httpOperations: OperationDescriptor[],
  functionTools: FunctionToolDescriptor[],
  sseEvents: SseEventDescriptor[],
): void {
  const duplicateOperationIds = findDuplicates(
    httpOperations.map((operation) => operation.operationId),
  )
  if (duplicateOperationIds.length > 0) {
    throw new ContractError(
      'CONTRACT_DUPLICATE_ID',
      `Duplicate operation IDs: ${duplicateOperationIds.join(', ')}`,
    )
  }

  const duplicateOperationPaths = findDuplicates(
    httpOperations.map((operation) => `${operation.method} ${operation.path}`),
  )
  if (duplicateOperationPaths.length > 0) {
    throw new ContractError(
      'CONTRACT_DUPLICATE_ID',
      `Duplicate HTTP method/path pairs: ${duplicateOperationPaths.join(', ')}`,
    )
  }

  const duplicateToolNames = findDuplicates(functionTools.map((tool) => tool.name))
  if (duplicateToolNames.length > 0) {
    throw new ContractError(
      'CONTRACT_DUPLICATE_ID',
      `Duplicate function tool names: ${duplicateToolNames.join(', ')}`,
    )
  }

  const duplicateSseEvents = findDuplicates(sseEvents.map((event) => event.event))
  if (duplicateSseEvents.length > 0) {
    throw new ContractError(
      'CONTRACT_DUPLICATE_ID',
      `Duplicate SSE event names: ${duplicateSseEvents.join(', ')}`,
    )
  }
}

function validateSchemaBindings(
  schemas: readonly SchemaDescriptor[],
  httpOperations: readonly OperationDescriptor[],
  functionTools: readonly FunctionToolDescriptor[],
  sseEvents: readonly SseEventDescriptor[],
  invariants: readonly InvariantDefinition[],
): void {
  const schemaIds = new Set(schemas.map((schema) => schema.id))
  const assertRegistered = (schemaId: string, context: string) => {
    if (!schemaIds.has(schemaId)) {
      throw new ContractError(
        'CONTRACT_UNRESOLVED_REF',
        `Unregistered schema ID at ${context}: ${schemaId}`,
      )
    }
  }

  for (const operation of httpOperations) {
    if (operation.requestSchemaId) {
      assertRegistered(operation.requestSchemaId, `${operation.operationId}.requestSchemaId`)
    }
    for (const [status, schemaId] of Object.entries(operation.responses)) {
      if (schemaId) {
        assertRegistered(schemaId, `${operation.operationId}.responses.${status}`)
      }
    }
  }

  for (const tool of functionTools) {
    assertRegistered(tool.inputSchemaId, `${tool.name}.inputSchemaId`)
    assertRegistered(tool.outputSchemaId, `${tool.name}.outputSchemaId`)
  }

  for (const event of sseEvents) {
    assertRegistered(event.schemaId, `${event.event}.schemaId`)
  }

  for (const invariant of invariants) {
    for (const schemaId of invariant.appliesTo) {
      assertRegistered(schemaId, `${invariant.id}.appliesTo`)
    }
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
  const unresolvedRefFile = resolve(refFile)
  const unresolvedSchemasDir = resolve(schemasDir)
  const isOutside = (candidate: string, root: string) => {
    const pathFromRoot = relative(root, candidate)
    return pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)
  }

  // 先在词法路径上拒绝 ../ 与相邻前缀（schemas-escape）绕过；随后再用 realpath
  // 处理 symlink 指向目录外的情况。readFile 始终使用 realpath 后的位置。
  if (isOutside(unresolvedRefFile, unresolvedSchemasDir)) {
    throw new ContractError('CONTRACT_UNSAFE_PATH', `Path traversal attempt in ${fileName}: ${ref}`)
  }

  let resolvedRefFile: string
  let resolvedSchemasDir: string
  try {
    const resolvedPaths = await Promise.all([realpath(refFile), realpath(schemasDir)])
    resolvedRefFile = resolvedPaths[0]
    resolvedSchemasDir = resolvedPaths[1]
  } catch {
    throw new ContractError(
      'CONTRACT_UNRESOLVED_REF',
      `Unresolved file reference in ${fileName}: ${ref}`,
    )
  }

  if (isOutside(resolvedRefFile, resolvedSchemasDir)) {
    throw new ContractError('CONTRACT_UNSAFE_PATH', `Path traversal attempt in ${fileName}: ${ref}`)
  }

  const refContent = await readFile(resolvedRefFile, 'utf-8')

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
    entries.sort((left, right) => left.name.localeCompare(right.name))
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
    entries.sort((left, right) => left.name.localeCompare(right.name))
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

type DefEntry = { schema: Record<string, unknown>; file: string }
type DefsMap = Map<string, DefEntry>
type SchemaLocation = { file: string; defName: string }

/**
 * Ajv standalone 会把其 CJS runtime helpers（以及 ajv-formats）生成为 require()。
 * 服务端是原生 ESM，而测试运行器的 CJS interop 又与 Node ESM 不同，因此在完整
 * `require(...).property` 边界改写：`.default` 经过兼容归一化，具名导出直接导入。
 */
function rewriteStandaloneCommonJsRequiresAsEsm(standaloneCode: string): string {
  const imports: string[] = []
  const aliases = new Map<string, string>()
  const esmModuleId = (moduleId: string) =>
    moduleId.startsWith('ajv/') || moduleId.startsWith('ajv-formats/') ? `${moduleId}.js` : moduleId

  const getDefaultInteropAlias = (moduleId: string) => {
    const key = `${moduleId}#default`
    const existing = aliases.get(key)
    if (existing) return existing

    const moduleAlias = `contractStandaloneModule${aliases.size}`
    const alias = `${moduleAlias}Default`
    imports.push(`import ${moduleAlias} from ${JSON.stringify(esmModuleId(moduleId))}`)
    imports.push(`const ${alias} = ${moduleAlias}.default ?? ${moduleAlias}`)
    aliases.set(key, alias)
    return alias
  }

  const getNamedAlias = (moduleId: string, property: string) => {
    const key = `${moduleId}#${property}`
    const existing = aliases.get(key)
    if (existing) return existing

    const alias = `contractStandaloneModule${aliases.size}`
    imports.push(`import { ${property} as ${alias} } from ${JSON.stringify(esmModuleId(moduleId))}`)
    aliases.set(key, alias)
    return alias
  }

  let rewritten = standaloneCode.replace(
    /require\("([^"\\]+)"\)\.default/g,
    (_match, moduleId: string) => getDefaultInteropAlias(moduleId),
  )
  rewritten = rewritten.replace(
    /require\("([^"\\]+)"\)\.([A-Za-z_$][A-Za-z0-9_$]*)/g,
    (_match, moduleId: string, property: string) => getNamedAlias(moduleId, property),
  )

  if (imports.length === 0) return rewritten
  return `${imports.join('\n')}\n${rewritten}`
}

function listSchemaFiles(schemasDir: string): string[] {
  return readdirSync(schemasDir)
    .filter((file) => file.endsWith('.schema.json'))
    .sort((left, right) => left.localeCompare(right))
}

/**
 * 收集所有 schema 定义
 */
function collectAllDefs(schemasDir: string): DefsMap {
  const allDefs: DefsMap = new Map()
  for (const file of listSchemaFiles(schemasDir)) {
    const content = readFileSync(join(schemasDir, file), 'utf-8')
    const schema = JSON.parse(content) as Record<string, unknown>
    const defs = schema.$defs
    if (!isRecord(defs)) continue
    for (const [name, def] of Object.entries(defs)) {
      if (!isRecord(def)) {
        throw new ContractError(
          'CONTRACT_UNRESOLVED_REF',
          `Invalid schema definition: ${file}#${name}`,
        )
      }
      allDefs.set(`${file}#/$defs/${name}`, { schema: def, file })
      allDefs.set(name, { schema: def, file })
    }
  }
  return allDefs
}

function kotlinString(value: string): string {
  // JSON 字符串字面量与 Kotlin 字符串转义兼容；额外转义 $，避免生成的契约值被
  // Kotlin 视为字符串模板。
  return JSON.stringify(value).replaceAll('$', '\\$')
}

function kotlinStringSet(values: readonly string[]): string {
  if (values.length === 0) return 'emptySet()'
  return `setOf(${values.map(kotlinString).join(', ')})`
}

function kotlinJsonStringList(values: readonly unknown[]): string {
  if (values.length === 0) return 'emptyList()'
  return `listOf(${values
    .map((value) => {
      const json = JSON.stringify(value)
      if (json === undefined) {
        throw new ContractError('CONTRACT_META_INVALID', 'Invariant vectors must be JSON values')
      }
      return kotlinString(json)
    })
    .join(', ')})`
}

function resolveKotlinModelSchemaId(
  schemaId: string,
  allDefs: DefsMap,
  visited = new Set<string>(),
): string {
  if (visited.has(schemaId)) {
    throw new ContractError('CONTRACT_UNRESOLVED_REF', `Cyclic schema alias: ${schemaId}`)
  }
  visited.add(schemaId)

  const entry = allDefs.get(schemaId)
  if (!entry) {
    throw new ContractError('CONTRACT_UNRESOLVED_REF', `Schema not found: ${schemaId}`)
  }
  if (typeof entry.schema.$ref !== 'string') return schemaId

  const resolved = resolveRef(entry.schema.$ref, entry.file, allDefs, new Set())
  if (!resolved) {
    throw new ContractError('CONTRACT_UNRESOLVED_REF', `Cannot resolve Kotlin schema: ${schemaId}`)
  }
  const targetSchemaId = resolved.key.split('#/$defs/')[1]
  if (!targetSchemaId) {
    throw new ContractError(
      'CONTRACT_UNRESOLVED_REF',
      `Kotlin schema reference has no definition target: ${entry.schema.$ref}`,
    )
  }
  return resolveKotlinModelSchemaId(targetSchemaId, allDefs, visited)
}

/**
 * 生成 Android 协议目录。
 *
 * 这份文件与 JSON protocol-catalog 使用同一 manifest，是 Android SSE interpreter
 * 和不变量入口的唯一事实来源；事件 data 的反序列化仍委托给生成 DTO serializer。
 */
async function generateKotlinProtocolCatalog(
  sourceRoot: string,
  outputRoot: string,
  manifest: ContractManifest,
): Promise<void> {
  const allDefs = collectAllDefs(join(sourceRoot, 'schemas'))
  const schemaModelIds = new Map(
    manifest.sseEvents.map((event) => [
      event.schemaId,
      resolveKotlinModelSchemaId(event.schemaId, allDefs),
    ]),
  )
  const modelIds = Array.from(new Set(schemaModelIds.values())).sort((left, right) =>
    left.localeCompare(right),
  )

  const lines: string[] = [
    '@file:Suppress("unused")',
    '',
    'package io.yggdrasil.labs.mealmate.lite.contract.generated',
    '',
    'import kotlinx.serialization.decodeFromString',
    'import kotlinx.serialization.json.Json',
    ...modelIds.map(
      (modelId) => `import io.yggdrasil.labs.mealmate.lite.contract.generated.models.${modelId}`,
    ),
    '',
    '/**',
    ' * 协议目录 - 由契约编译器生成，禁止手改。',
    ' * @generated',
    ' */',
    'data class GeneratedSseToolLifecycleRule(',
    '    val idField: String,',
    '    val statusField: String,',
    '    val startedStatus: String,',
    '    val terminalStatuses: Set<String>,',
    ')',
    '',
    'data class GeneratedSseConfirmationTokenRule(',
    '    val stateField: String,',
    '    val tokenField: String,',
    '    val tokenRequiredState: String,',
    '    val tokenForbiddenStates: Set<String>,',
    ')',
    '',
    'data class GeneratedSseErrorCatalogRule(',
    '    val errCodeField: String,',
    '    val retryableField: String,',
    '    val requestIdField: String,',
    ')',
    '',
    'data class GeneratedPublicErrorDefinition(',
    '    val errCode: String,',
    '    val httpStatus: Int,',
    '    val retryable: Boolean,',
    '    val retryAfter: GeneratedRetryAfterPolicy,',
    '    val channels: Set<String>,',
    ')',
    '',
    'data class GeneratedRetryAfterPolicy(',
    '    val kind: String,',
    '    val seconds: Int? = null,',
    '    val minSeconds: Int? = null,',
    '    val maxSeconds: Int? = null,',
    ')',
    '',
    'data class GeneratedInvariantDefinition(',
    '    val id: GeneratedInvariantId,',
    '    val appliesTo: Set<String>,',
    '    val owners: Set<String>,',
    '    /** Canonical JSON inputs, shared by Server and Android regression tests. */',
    '    val validVectors: List<String>,',
    '    val invalidVectors: List<String>,',
    ')',
    '',
    'data class GeneratedSseEventDefinition(',
    '    val event: String,',
    '    val schemaId: String,',
    '    val isStart: Boolean,',
    '    val isTerminal: Boolean,',
    '    val nextEvents: Set<String>,',
    '    val toolLifecycle: GeneratedSseToolLifecycleRule? = null,',
    '    val confirmationToken: GeneratedSseConfirmationTokenRule? = null,',
    '    val errorCatalog: GeneratedSseErrorCatalogRule? = null,',
    '    val mutuallyExclusiveDataFields: Set<String> = emptySet(),',
    ')',
    '',
    'enum class GeneratedInvariantId {',
    ...manifest.invariants.map((invariant) => `    ${invariant.id},`),
    '}',
    '',
    'object GeneratedProtocolCatalog {',
    '    val sseEvents: List<GeneratedSseEventDefinition> =',
    '        listOf(',
  ]

  for (const event of manifest.sseEvents) {
    lines.push('            GeneratedSseEventDefinition(')
    lines.push(`                event = ${kotlinString(event.event)},`)
    lines.push(`                schemaId = ${kotlinString(event.schemaId)},`)
    lines.push(`                isStart = ${event.isStart},`)
    lines.push(`                isTerminal = ${event.isTerminal},`)
    lines.push(`                nextEvents = ${kotlinStringSet(event.nextEvents)},`)
    if (event.toolLifecycle) {
      lines.push('                toolLifecycle = GeneratedSseToolLifecycleRule(')
      lines.push(`                    idField = ${kotlinString(event.toolLifecycle.idField)},`)
      lines.push(
        `                    statusField = ${kotlinString(event.toolLifecycle.statusField)},`,
      )
      lines.push(
        `                    startedStatus = ${kotlinString(event.toolLifecycle.startedStatus)},`,
      )
      lines.push(
        `                    terminalStatuses = ${kotlinStringSet(event.toolLifecycle.terminalStatuses)},`,
      )
      lines.push('                ),')
    }
    if (event.confirmationToken) {
      lines.push('                confirmationToken = GeneratedSseConfirmationTokenRule(')
      lines.push(
        `                    stateField = ${kotlinString(event.confirmationToken.stateField)},`,
      )
      lines.push(
        `                    tokenField = ${kotlinString(event.confirmationToken.tokenField)},`,
      )
      lines.push(
        `                    tokenRequiredState = ${kotlinString(event.confirmationToken.tokenRequiredState)},`,
      )
      lines.push(
        `                    tokenForbiddenStates = ${kotlinStringSet(event.confirmationToken.tokenForbiddenStates)},`,
      )
      lines.push('                ),')
    }
    if (event.errorCatalog) {
      lines.push('                errorCatalog = GeneratedSseErrorCatalogRule(')
      lines.push(
        `                    errCodeField = ${kotlinString(event.errorCatalog.errCodeField)},`,
      )
      lines.push(
        `                    retryableField = ${kotlinString(event.errorCatalog.retryableField)},`,
      )
      lines.push(
        `                    requestIdField = ${kotlinString(event.errorCatalog.requestIdField)},`,
      )
      lines.push('                ),')
    }
    lines.push(
      `                mutuallyExclusiveDataFields = ${kotlinStringSet(event.mutuallyExclusiveDataFields ?? [])},`,
    )
    lines.push('            ),')
  }

  lines.push('        )')
  lines.push('')
  lines.push('    val sseEventMap: Map<String, GeneratedSseEventDefinition> =')
  lines.push('        sseEvents.associateBy { it.event }')
  lines.push('')
  lines.push('    val errors: List<GeneratedPublicErrorDefinition> =')
  lines.push('        listOf(')
  for (const error of manifest.errors) {
    lines.push('            GeneratedPublicErrorDefinition(')
    lines.push(`                errCode = ${kotlinString(error.errCode)},`)
    lines.push(`                httpStatus = ${error.httpStatus},`)
    lines.push(`                retryable = ${error.retryable},`)
    lines.push('                retryAfter = GeneratedRetryAfterPolicy(')
    lines.push(`                    kind = ${kotlinString(error.retryAfter.kind)},`)
    if (error.retryAfter.kind === 'fixed') {
      lines.push(`                    seconds = ${error.retryAfter.seconds},`)
    } else if (error.retryAfter.kind === 'range') {
      lines.push(`                    minSeconds = ${error.retryAfter.minSeconds},`)
      lines.push(`                    maxSeconds = ${error.retryAfter.maxSeconds},`)
    }
    lines.push('                ),')
    lines.push(`                channels = ${kotlinStringSet(error.channels)},`)
    lines.push('            ),')
  }
  lines.push('        )')
  lines.push('')
  lines.push('    val errorMap: Map<String, GeneratedPublicErrorDefinition> =')
  lines.push('        errors.associateBy { it.errCode }')
  lines.push('')
  lines.push('    val invariantDefinitions: List<GeneratedInvariantDefinition> =')
  lines.push('        listOf(')
  for (const invariant of manifest.invariants) {
    lines.push('            GeneratedInvariantDefinition(')
    lines.push(`                id = GeneratedInvariantId.${invariant.id},`)
    lines.push(`                appliesTo = ${kotlinStringSet(invariant.appliesTo)},`)
    lines.push(`                owners = ${kotlinStringSet(invariant.owners)},`)
    lines.push(`                validVectors = ${kotlinJsonStringList(invariant.vectors.valid)},`)
    lines.push(
      `                invalidVectors = ${kotlinJsonStringList(invariant.vectors.invalid)},`,
    )
    lines.push('            ),')
  }
  lines.push('        )')
  lines.push('')
  lines.push('    val invariantMap: Map<GeneratedInvariantId, GeneratedInvariantDefinition> =')
  lines.push('        invariantDefinitions.associateBy { it.id }')
  lines.push('')
  lines.push('    val invariants: Set<GeneratedInvariantId> = invariantMap.keys')
  lines.push('')
  lines.push('    fun validateEventData(schemaId: String, json: Json, data: String): String? =')
  lines.push('        runCatching {')
  lines.push('            when (schemaId) {')
  for (const [schemaId, modelId] of schemaModelIds) {
    lines.push(
      `                ${kotlinString(schemaId)} -> json.decodeFromString<${modelId}>(data)`,
    )
  }
  lines.push('                else -> error("Unknown SSE event schema: $schemaId")')
  lines.push('            }')
  lines.push('        }.fold(')
  lines.push('            onSuccess = { null },')
  lines.push('            onFailure = { error -> error.message ?: "Invalid event data" },')
  lines.push('        )')
  lines.push('}')

  await writeFile(join(outputRoot, 'ProtocolCatalog.kt'), `${lines.join('\n')}\n`)
}

function collectSchemaLocations(schemasDir: string): Record<string, SchemaLocation> {
  const locations: Record<string, SchemaLocation> = {}

  for (const file of listSchemaFiles(schemasDir)) {
    const schema = JSON.parse(readFileSync(join(schemasDir, file), 'utf-8')) as Record<
      string,
      unknown
    >
    const defs = schema.$defs
    if (!isRecord(defs)) continue
    for (const [defName, definition] of Object.entries(defs)) {
      if (!isRecord(definition)) {
        throw new ContractError(
          'CONTRACT_UNRESOLVED_REF',
          `Invalid schema definition: ${file}#${defName}`,
        )
      }
      locations[defName] = { file, defName }
    }
  }

  return locations
}

function collectToolInputLocations(
  manifest: ContractManifest,
  schemaLocations: Record<string, SchemaLocation>,
): Record<string, SchemaLocation> {
  const locations: Record<string, SchemaLocation> = {}

  for (const tool of manifest.functionTools) {
    const location = schemaLocations[tool.inputSchemaId]
    if (!location) {
      throw new ContractError(
        'CONTRACT_UNRESOLVED_REF',
        `Tool input schema not found: ${tool.name} -> ${tool.inputSchemaId}`,
      )
    }
    locations[tool.name] = location
  }

  return locations
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
  manifest: ContractManifest,
): Promise<void> {
  const allDefs = collectAllDefs(schemasDir)
  const schemaLocations = collectSchemaLocations(schemasDir)
  const toolInputLocations = collectToolInputLocations(manifest, schemaLocations)
  const schemaEntries = Object.entries(schemaLocations).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  const toolEntries = Object.entries(toolInputLocations).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  const schemaFiles = Array.from(new Set(schemaEntries.map(([, location]) => location.file))).sort(
    (left, right) => left.localeCompare(right),
  )

  const lines: string[] = [
    '/**',
    ' * Schema 常量与类型 - 由 compile.ts 生成，禁止手改',
    ' * @generated',
    ' */',
    '',
    "import type { FromSchema } from 'json-schema-to-ts'",
    `const manifest = ${JSON.stringify(
      { schemas: manifest.schemas, functionTools: manifest.functionTools },
      null,
      2,
    )} as const`,
    '',
    '// ============================================================================',
    '// Schema 文件列表',
    '// ============================================================================',
    '',
    'export const SCHEMA_FILES = [',
  ]

  for (const file of schemaFiles) {
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
  lines.push('export const functionTools = manifest.functionTools')
  lines.push('export const functionToolMap = new Map(functionTools.map((f) => [f.name, f]))')
  lines.push('export const schemaFileMap = new Map(schemas.map((s) => [s.id, s.file]))')
  lines.push('')

  // 生成公开 schema 常量
  lines.push('// ============================================================================')
  lines.push('// 展开的 Schema 常量 (as const)')
  lines.push('// ============================================================================')
  lines.push('')

  for (const [schemaId, loc] of schemaEntries) {
    const entry = allDefs.get(`${loc.file}#/$defs/${loc.defName}`)
    if (!entry) {
      throw new ContractError('CONTRACT_UNRESOLVED_REF', `Schema not found: ${schemaId}`)
    }
    const expanded = expandSchemaForTypes(entry.schema, entry.file, allDefs, new Set())
    lines.push(`export const ${schemaId}Schema = ${JSON.stringify(expanded, null, 2)} as const`)
    lines.push('')
  }

  lines.push('export const publicSchemaMap = {')
  for (const [schemaId] of schemaEntries) {
    lines.push(`  ${JSON.stringify(schemaId)}: ${schemaId}Schema,`)
  }
  lines.push('} as const')
  lines.push('')

  // 生成 schema 位置和工具输入位置映射
  lines.push('// ============================================================================')
  lines.push('// 运行时 schema 位置映射')
  lines.push('// ============================================================================')
  lines.push('')
  lines.push('export const schemaLocations = {')
  for (const [schemaId, location] of schemaEntries) {
    lines.push(
      `  ${JSON.stringify(schemaId)}: { file: ${JSON.stringify(location.file)}, defPath: ${JSON.stringify(`/$defs/${location.defName}`)} },`,
    )
  }
  lines.push('} as const')
  lines.push('')
  lines.push('export const toolInputSchemaLocations = {')
  for (const [toolName, location] of toolEntries) {
    lines.push(
      `  ${JSON.stringify(toolName)}: { file: ${JSON.stringify(location.file)}, defPath: ${JSON.stringify(`/$defs/${location.defName}`)} },`,
    )
  }
  lines.push('} as const')
  lines.push('')
  lines.push('export const PUBLIC_SCHEMA_IDS = Object.keys(schemaLocations)')
  lines.push('export const FUNCTION_TOOL_NAMES = Object.keys(toolInputSchemaLocations)')
  lines.push('')

  // 生成 FromSchema 类型
  lines.push('// ============================================================================')
  lines.push('// FromSchema 类型推导')
  lines.push('// ============================================================================')
  lines.push('')

  for (const [schemaId] of schemaEntries) {
    lines.push(`export type ${schemaId} = FromSchema<typeof ${schemaId}Schema>`)
  }
  lines.push('')

  // 生成 ContractType 映射
  lines.push('// ============================================================================')
  lines.push('// 类型映射')
  lines.push('// ============================================================================')
  lines.push('')
  lines.push('/** PublicSchemaId 类型 */')
  const schemaIds = schemaEntries.map(([schemaId]) => schemaId)
  lines.push('export type PublicSchemaId = keyof typeof schemaLocations')
  lines.push('')

  lines.push('/** FunctionToolName 类型 */')
  lines.push('export type FunctionToolName = keyof typeof toolInputSchemaLocations')
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
  for (const [toolName, location] of toolEntries) {
    lines.push(`  ${JSON.stringify(toolName)}: ${location.defName}`)
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
  const schemaLocations = collectSchemaLocations(schemasDir)
  const schemaEntries = Object.entries(schemaLocations).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  const schemaFiles = Array.from(new Set(schemaEntries.map(([, location]) => location.file))).sort(
    (left, right) => left.localeCompare(right),
  )

  // 动态导入 Ajv 2020-12 和 standalone。显式描述最小接口，避免把运行时
  // import 退化为 any 并丢失生成器边界的类型约束。
  const Ajv2020Module = (await import('ajv/dist/2020.js')) as unknown as {
    Ajv2020?: StandaloneAjvConstructor
    default?: StandaloneAjvConstructor
  }
  const Ajv2020 = Ajv2020Module.Ajv2020 ?? Ajv2020Module.default
  if (!Ajv2020)
    throw new ContractError('CONTRACT_META_INVALID', 'Ajv 2020 standalone is unavailable')

  const addFormatsModule = (await import('ajv-formats')) as unknown as {
    default?: AddFormatsInstaller
  }
  const addFormats = addFormatsModule.default
  if (!addFormats)
    throw new ContractError('CONTRACT_META_INVALID', 'Ajv formats installer is unavailable')

  const standaloneModule = (await import('ajv/dist/standalone/index.js')) as unknown as {
    default?: StandaloneCodeGenerator
  }
  const standaloneCode = standaloneModule.default
  if (!standaloneCode)
    throw new ContractError('CONTRACT_META_INVALID', 'Ajv standalone generator is unavailable')

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
  for (const file of schemaFiles) {
    const content = readFileSync(join(schemasDir, file), 'utf-8')
    const schema = JSON.parse(content) as Record<string, unknown>
    ajv.addSchema({ ...schema, $id: file })
  }

  // 收集需要编译的 validator 引用
  const validatorRefs: Record<string, string> = {}

  // 每个公开 schema 都生成一个 validator，运行时无需手工注册子集。
  for (const [schemaId, loc] of schemaEntries) {
    const ref = `${loc.file}#/$defs/${loc.defName}`
    const funcName = `validate${schemaId}`
    ajv.compile({ $ref: ref })
    validatorRefs[funcName] = ref
  }

  // 生成 standalone 代码
  const code = rewriteStandaloneCommonJsRequiresAsEsm(standaloneCode(ajv, validatorRefs))

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

  // 每个公开 schema 的映射
  for (const [schemaId, loc] of schemaEntries) {
    const key = `${loc.file}#/$defs/${loc.defName}`
    const funcName = `validate${schemaId}`
    lines.push(`  '${key}': ${funcName},`)
  }

  lines.push('}')
  lines.push('')
  lines.push('/**')
  lines.push(' * 获取预编译的 validator')
  lines.push(' */')
  lines.push('export function getValidator(file: string, defPath: string): ValidateFunction {')
  lines.push(['  const key = `', '$' + '{file}', '#', '$' + '{defPath}', '`'].join(''))
  lines.push('  const validator = validatorMap[key]')
  lines.push(
    ['  if (!validator) throw new Error(`No validator for: ', '$' + '{key}', '`)'].join(''),
  )
  lines.push('  return validator')
  lines.push('}')
  lines.push('')

  await writeFile(outputPath, `${lines.join('\n')}\n`)
}

/** Generate the self-contained typed Server view over the authoritative protocol catalog. */
export async function generateTypeScriptCatalog(
  outputPath: string,
  manifest: ContractManifest,
): Promise<void> {
  const protocolCatalog = {
    errors: manifest.errors.map((error) => ({
      errCode: error.errCode,
      httpStatus: error.httpStatus,
      retryable: error.retryable,
      retryAfter: error.retryAfter,
      channels: error.channels,
    })),
    sseEvents: manifest.sseEvents,
    invariants: manifest.invariants.map((invariant) => ({
      id: invariant.id,
      appliesTo: invariant.appliesTo,
      owners: invariant.owners,
      vectors: invariant.vectors,
    })),
  }
  const lines = [
    '/**',
    ' * 协议目录 - 由 compile.ts 生成，禁止手改',
    ' * @generated',
    ' */',
    '',
    `const protocolCatalog = ${JSON.stringify(protocolCatalog, null, 2)} as const`,
    "import type { InvariantDefinition, PublicErrorDefinition, SseEventDescriptor } from '../types.js'",
    '',
    '/** 错误定义 */',
    'export const errors = protocolCatalog.errors as unknown as readonly PublicErrorDefinition[]',
    'export type ErrorEntry = PublicErrorDefinition',
    "export type PublicErrorCode = PublicErrorDefinition['errCode']",
    '',
    '/** SSE 事件定义 */',
    'export const sseEvents = protocolCatalog.sseEvents as unknown as readonly SseEventDescriptor[]',
    'export type SseEventEntry = (typeof sseEvents)[number]',
    "export type SseEventName = SseEventEntry['event']",
    '',
    '/** 不变量定义 */',
    'export const invariants = protocolCatalog.invariants as unknown as readonly InvariantDefinition[]',
    'export type InvariantEntry = (typeof invariants)[number]',
    "export type InvariantId = InvariantEntry['id']",
    '',
    '/** 错误码到定义的映射 */',
    'export const errorMap = new Map<string, PublicErrorDefinition>(errors.map((e) => [e.errCode, e]))',
    '',
    '/** SSE 事件到定义的映射 */',
    'export const sseEventMap = new Map<string, SseEventDescriptor>(',
    '  sseEvents.map((event) => [event.event, event]),',
    ')',
    '',
    '/** 不变量到定义的映射 */',
    'export const invariantMap = new Map(invariants.map((i) => [i.id, i]))',
  ]
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
  const publicSchemaIds = new Set(
    schemas.filter((schema) => schema.public).map((schema) => schema.id),
  )

  // 加载所有 schema 文件并提取 $defs
  const schemaFiles = Array.from(
    new Set(
      schemas.filter((schema) => schema.file.startsWith('schemas/')).map((schema) => schema.file),
    ),
  ).sort((left, right) => left.localeCompare(right))

  for (const file of schemaFiles) {
    const filePath = join(sourceRoot, file)
    const content = await readFile(filePath, 'utf-8')
    const schemaJson = JSON.parse(content) as Record<string, unknown>
    const defs = schemaJson.$defs as Record<string, unknown> | undefined

    if (defs) {
      const publicDefinitionNames = Object.keys(defs)
        .filter((defName) => publicSchemaIds.has(defName))
        .sort((left, right) => left.localeCompare(right))
      for (const defName of publicDefinitionNames) {
        const defSchema = defs[defName]
        if (!isRecord(defSchema)) {
          throw new ContractError(
            'CONTRACT_UNRESOLVED_REF',
            `Invalid schema definition: ${defName}`,
          )
        }
        // 内联 schema，移除 $schema 和 $id 等顶级属性
        const inlinedSchema = { ...defSchema }

        // 转换 $ref 引用：将文件相对引用转为 OpenAPI 内部引用
        // 例如：common.schema.json#/$defs/UUID -> #/components/schemas/UUID
        rewriteRefs(inlinedSchema)

        schemasMap[defName] = inlinedSchema
      }
    }
  }

  // 路径中的外部 JSON Schema 引用在增强版 OpenAPI 中必须指向 components/schemas。
  rewriteRefs(enhanced)

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
