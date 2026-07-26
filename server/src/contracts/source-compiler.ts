/**
 * 契约源编译器
 *
 * 从 contracts/v1/source/ 解析权威源，生成 manifest 和投影文件
 */
import { createHash } from 'node:crypto'
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
 * 参考：https://json-schema.org/draft/2020-12/json-schema-core.html#section-9.3
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

// Re-export types for convenience
export type { ContractManifest, GeneratedDiff } from './types.js'
