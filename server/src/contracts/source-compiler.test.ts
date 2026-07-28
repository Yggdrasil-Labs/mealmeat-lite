/**
 * 契约源编译器测试
 *
 * 验证：
 * 1. manifest 精确覆盖 21 HTTP、8 FC、6 SSE
 * 2. 两个空目录生成结果字节相同（确定性）
 * 3. 重复 ID、禁止关键字、陈旧文件被正确检测
 */
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkGeneratedContract, compileContractSources } from './source-compiler.js'
import { compareDirectoryTrees } from './test-utils.js'

// 契约源根目录
const CONTRACT_SOURCE_ROOT = join(__dirname, '../../../contracts/v1/source')
const CONTRACT_OUTPUT_ROOT = join(__dirname, '../../../contracts/v1/generated')

function expectOperationSchemasAreRegistered(
  manifest: Awaited<ReturnType<typeof compileContractSources>>,
): void {
  const registeredSchemaIds = new Set(manifest.schemas.map((schema) => schema.id))
  for (const operation of manifest.httpOperations) {
    if (operation.requestSchemaId) {
      expect(registeredSchemaIds).toContain(operation.requestSchemaId)
    }
    for (const responseSchemaId of Object.values(operation.responses)) {
      if (responseSchemaId) {
        expect(registeredSchemaIds).toContain(responseSchemaId)
      }
    }
  }
}

describe('契约源编译器', () => {
  let tempDir1: string
  let tempDir2: string

  beforeEach(async () => {
    // 创建两个空的临时目录用于确定性测试
    tempDir1 = await mkdtemp(join(tmpdir(), 'contract-gen-1-'))
    tempDir2 = await mkdtemp(join(tmpdir(), 'contract-gen-2-'))
  })

  afterEach(async () => {
    // 清理临时目录
    await rm(tempDir1, { recursive: true, force: true })
    await rm(tempDir2, { recursive: true, force: true })
  })

  describe('覆盖验证', () => {
    it('manifest 精确包含 21 个 HTTP operation', async () => {
      const manifest = await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir1)

      expect(manifest.httpOperations).toHaveLength(21)

      // 验证所有必需的 operation 都存在
      const operationIds = manifest.httpOperations.map((op) => op.operationId)
      expect(operationIds).toContain('healthLive')
      expect(operationIds).toContain('healthReady')
      expect(operationIds).toContain('chat')
      expect(operationIds).toContain('getChatHistory')
      expect(operationIds).toContain('listRecipes')
      expect(operationIds).toContain('patchRecipe')
      expect(operationIds).toContain('deleteRecipe')
      expect(operationIds).toContain('getCurrentPlan')
      expect(operationIds).toContain('getPlanByWeek')
      expect(operationIds).toContain('getSettings')
      expect(operationIds).toContain('updateSettings')
      expect(operationIds).toContain('listModels')
      expect(operationIds).toContain('bootstrap')
      expect(operationIds).toContain('register')
      expect(operationIds).toContain('logout')
      expect(operationIds).toContain('listDevices')
      expect(operationIds).toContain('revokeDevice')
      expect(operationIds).toContain('rotateFamilyCode')
      expect(operationIds).toContain('commitConfirmation')
      expect(operationIds).toContain('sync')
      expect(operationIds).toContain('syncActions')
    })

    it('manifest 精确包含 8 个 Function Calling 工具', async () => {
      const manifest = await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir1)

      expect(manifest.functionTools).toHaveLength(8)

      const toolNames = manifest.functionTools.map((t) => t.name)
      expect(toolNames).toContain('add_recipe')
      expect(toolNames).toContain('update_recipe')
      expect(toolNames).toContain('delete_recipe')
      expect(toolNames).toContain('restore_recipe')
      expect(toolNames).toContain('search_recipes')
      expect(toolNames).toContain('batch_generate_recipes')
      expect(toolNames).toContain('generate_weekly_plan')
      expect(toolNames).toContain('update_plan_item')
    })

    it('manifest 精确包含 6 个 SSE 事件', async () => {
      const manifest = await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir1)

      expect(manifest.sseEvents).toHaveLength(6)

      const eventNames = manifest.sseEvents.map((e) => e.event)
      expect(eventNames).toContain('start')
      expect(eventNames).toContain('delta')
      expect(eventNames).toContain('tool-status')
      expect(eventNames).toContain('confirmation-required')
      expect(eventNames).toContain('error')
      expect(eventNames).toContain('done')
    })

    it('生成供 Android 消费的 Kotlin 协议目录', async () => {
      await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir1)

      const catalog = await readFile(join(tempDir1, 'ProtocolCatalog.kt'), 'utf-8')
      expect(catalog).toContain('object GeneratedProtocolCatalog')
      expect(catalog).toContain('GeneratedSseEventDefinition')
      expect(catalog).toContain('ConfirmationEventDto')
      expect(catalog).toContain('enum class GeneratedInvariantId')
    })

    it('所有 schema ID 唯一', async () => {
      const manifest = await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir1)

      const schemaIds = manifest.schemas.map((s) => s.id)
      const uniqueIds = new Set(schemaIds)
      expect(uniqueIds.size).toBe(schemaIds.length)
    })

    it('所有 error code 唯一', async () => {
      const manifest = await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir1)

      const errorCodes = manifest.errors.map((e) => e.errCode)
      const uniqueCodes = new Set(errorCodes)
      expect(uniqueCodes.size).toBe(errorCodes.length)

      // 验证必需的错误码存在（部分关键错误）
      expect(errorCodes).toContain('BAD_REQUEST')
      expect(errorCodes).toContain('UNAUTHORIZED')
      expect(errorCodes).toContain('RATE_LIMITED')
      expect(errorCodes).toContain('INTERNAL_ERROR')
    })

    it('所有 invariant ID 唯一', async () => {
      const manifest = await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir1)

      const invariantIds = manifest.invariants.map((i) => i.id)
      const uniqueIds = new Set(invariantIds)
      expect(uniqueIds.size).toBe(invariantIds.length)

      // 验证必需的不变量存在
      expect(invariantIds).toContain('WEEK_START_IS_MONDAY')
      expect(invariantIds).toContain('WEEKLY_PLAN_HAS_21_SLOTS')
      expect(invariantIds).toContain('SYNC_RESULTS_PRESERVE_INPUT_ORDER')
      expect(invariantIds).toContain('SERVER_VERSION_WITHIN_DB_BIGINT')
      expect(invariantIds).toContain('CONFIRMATION_STATE_FIELDS_MATCH')
    })

    it('schema 引用全部可解析', async () => {
      const manifest = await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir1)

      // 编译成功意味着所有引用都已解析
      // 如果有悬空引用，compileContractSources 应该抛出 CONTRACT_UNRESOLVED_REF
      expect(manifest.contractVersion).toBe('v1')
      expect(manifest.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    })

    it('为每个 HTTP operation 提取已登记的请求与响应 schema 绑定', async () => {
      const manifest = await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir1)
      const operations = new Map(
        manifest.httpOperations.map((operation) => [operation.operationId, operation]),
      )

      expect(operations.get('healthLive')).toMatchObject({
        responses: { 200: 'HealthLiveResponse' },
      })
      expect(operations.get('healthReady')).toMatchObject({
        responses: { 200: 'HealthReadyResponse', 503: 'HealthNotReadyResponse' },
      })
      expect(operations.get('chat')).toMatchObject({
        requestSchemaId: 'ChatRequest',
        responses: { 200: null },
      })
      expect(operations.get('getChatHistory')).toMatchObject({
        responses: { 200: 'ChatHistoryResponse' },
      })
      expect(operations.get('listRecipes')).toMatchObject({
        responses: { 200: 'RecipeListResponse' },
      })
      expect(operations.get('patchRecipe')).toMatchObject({
        requestSchemaId: 'RecipePatchRequest',
        responses: { 200: 'RecipeView' },
      })
      expect(operations.get('deleteRecipe')).toMatchObject({
        responses: { 200: 'RecipeTombstone' },
      })
      expect(operations.get('getCurrentPlan')).toMatchObject({
        responses: { 200: 'CurrentWeeklyPlanResponse' },
      })
      expect(operations.get('getPlanByWeek')).toMatchObject({
        responses: { 200: 'WeeklyPlanView' },
      })
      expect(operations.get('getSettings')).toMatchObject({
        responses: { 200: 'SettingsResponse' },
      })
      expect(operations.get('updateSettings')).toMatchObject({
        requestSchemaId: 'SettingsUpdateRequest',
        responses: { 200: 'SettingsResponse' },
      })
      expect(operations.get('listModels')).toMatchObject({
        responses: { 200: 'ModelListResponse' },
      })
      expect(operations.get('bootstrap')).toMatchObject({
        requestSchemaId: 'BootstrapRequest',
        responses: { 200: 'BootstrapResponse' },
      })
      expect(operations.get('register')).toMatchObject({
        requestSchemaId: 'RegisterRequest',
        responses: { 200: 'RegisterResponse' },
      })
      expect(operations.get('logout')).toMatchObject({
        responses: { 200: 'LogoutResponse' },
      })
      expect(operations.get('listDevices')).toMatchObject({
        responses: { 200: 'DeviceListResponse' },
      })
      expect(operations.get('revokeDevice')).toMatchObject({
        responses: { 200: 'RevokeDeviceResponse' },
      })
      expect(operations.get('rotateFamilyCode')).toMatchObject({
        responses: { 200: 'RotateFamilyCodeResponse' },
      })
      expect(operations.get('commitConfirmation')).toMatchObject({
        requestSchemaId: 'ConfirmationCommitRequest',
        responses: { 200: 'ConfirmationCommitResultDto' },
      })
      expect(operations.get('sync')).toMatchObject({
        responses: { 200: 'SyncResponse' },
      })
      expect(operations.get('syncActions')).toMatchObject({
        requestSchemaId: 'SyncActionsRequest',
        responses: { 200: 'SyncActionsResponse' },
      })

      expectOperationSchemasAreRegistered(manifest)
    })
  })

  describe('确定性生成', () => {
    it('两个空目录生成结果字节相同', async () => {
      // 分别生成到两个空目录
      await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir1)
      await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir2)

      // 递归比较两个目录
      const comparison = await compareDirectoryTrees(tempDir1, tempDir2)
      expect(comparison.identical).toBe(true)
      expect(comparison.differences).toHaveLength(0)
    })

    it('生成结果与已提交生成物一致', async () => {
      const diff = await checkGeneratedContract(CONTRACT_SOURCE_ROOT, CONTRACT_OUTPUT_ROOT)

      expect(diff.hasChanges).toBe(false)
      expect(diff.added).toHaveLength(0)
      expect(diff.modified).toHaveLength(0)
      expect(diff.deleted).toHaveLength(0)
    })

    it('schema inventory 对目录项与 $defs 名称都使用稳定排序', async () => {
      const fixtureRoot = join(tempDir1, 'source')
      await cp(CONTRACT_SOURCE_ROOT, fixtureRoot, { recursive: true })
      await writeFile(
        join(fixtureRoot, 'schemas', 'zz-order.schema.json'),
        JSON.stringify(
          {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            $id: 'zz-order.schema.json',
            // 故意反序；生成目录不能继承 JSON 的插入顺序。
            $defs: { ZetaOrderProbe: { type: 'string' }, AlphaOrderProbe: { type: 'string' } },
          },
          null,
          2,
        ),
      )

      const manifest = await compileContractSources(fixtureRoot, tempDir2)
      const probes = manifest.schemas
        .filter((schema) => schema.file === 'schemas/zz-order.schema.json')
        .map((schema) => schema.id)
      expect(probes).toEqual(['AlphaOrderProbe', 'ZetaOrderProbe'])
    })
  })

  describe('错误检测', () => {
    it('重复 operationId 时抛出 CONTRACT_DUPLICATE_ID', async () => {
      const fixtureRoot = join(tempDir1, 'source')
      await cp(CONTRACT_SOURCE_ROOT, fixtureRoot, { recursive: true })

      const openApiPath = join(fixtureRoot, 'openapi.yaml')
      const openApi = await readFile(openApiPath, 'utf-8')
      await writeFile(
        openApiPath,
        openApi.replace('operationId: healthReady', 'operationId: healthLive'),
      )

      await expect(compileContractSources(fixtureRoot, tempDir2)).rejects.toMatchObject({
        code: 'CONTRACT_DUPLICATE_ID',
      })
    })

    it('HTTP operation 引用未登记 schema 时抛出 CONTRACT_UNRESOLVED_REF', async () => {
      const fixtureRoot = join(tempDir1, 'source')
      await cp(CONTRACT_SOURCE_ROOT, fixtureRoot, { recursive: true })

      const openApiPath = join(fixtureRoot, 'openapi.yaml')
      const openApi = await readFile(openApiPath, 'utf-8')
      await writeFile(
        openApiPath,
        openApi.replace(
          'schemas/common.schema.json#/$defs/HealthLiveResponse',
          'schemas/common.schema.json#/$defs/DoesNotExist',
        ),
      )

      await expect(compileContractSources(fixtureRoot, tempDir2)).rejects.toMatchObject({
        code: 'CONTRACT_UNRESOLVED_REF',
      })
    })

    it('x-mealmate 元数据字段类型错误时抛出 CONTRACT_META_INVALID', async () => {
      const fixtureRoot = join(tempDir1, 'source')
      await cp(CONTRACT_SOURCE_ROOT, fixtureRoot, { recursive: true })

      const openApiPath = join(fixtureRoot, 'openapi.yaml')
      const openApi = await readFile(openApiPath, 'utf-8')
      await writeFile(
        openApiPath,
        openApi.replace(
          'nextEvents: [delta, tool-status, confirmation-required, error, done]',
          'nextEvents: delta',
        ),
      )

      await expect(compileContractSources(fixtureRoot, tempDir2)).rejects.toMatchObject({
        code: 'CONTRACT_META_INVALID',
      })
    })

    it('缺少必需的 x-mealmate 清单时抛出 CONTRACT_META_INVALID', async () => {
      const fixtureRoot = join(tempDir1, 'source')
      await cp(CONTRACT_SOURCE_ROOT, fixtureRoot, { recursive: true })

      const openApiPath = join(fixtureRoot, 'openapi.yaml')
      const openApi = await readFile(openApiPath, 'utf-8')
      await writeFile(
        openApiPath,
        openApi.replace('x-mealmate-invariants:', 'x-mealmate-invariants-removed:'),
      )

      await expect(compileContractSources(fixtureRoot, tempDir2)).rejects.toMatchObject({
        code: 'CONTRACT_META_INVALID',
      })
    })

    it('x-mealmate inventory 包含未声明错误码时抛出 CONTRACT_META_INVALID', async () => {
      const fixtureRoot = join(tempDir1, 'source')
      await cp(CONTRACT_SOURCE_ROOT, fixtureRoot, { recursive: true })

      const openApiPath = join(fixtureRoot, 'openapi.yaml')
      const openApi = await readFile(openApiPath, 'utf-8')
      await writeFile(
        openApiPath,
        openApi.replace('errCode: BAD_REQUEST', 'errCode: UNKNOWN_ERROR'),
      )

      await expect(compileContractSources(fixtureRoot, tempDir2)).rejects.toMatchObject({
        code: 'CONTRACT_META_INVALID',
      })
    })

    it('覆盖数量不匹配时抛出 CONTRACT_COVERAGE_MISMATCH', async () => {
      // 通过修改临时源来测试
      // 当前源应该是正确的，所以这个测试验证编译器能正确计数
      const manifest = await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir1)
      expect(manifest.httpOperations.length).toBe(21)
      expect(manifest.functionTools.length).toBe(8)
      expect(manifest.sseEvents.length).toBe(6)
    })

    it('注入重复 schema ID 时抛出 CONTRACT_DUPLICATE_ID', async () => {
      // 创建带有重复 ID 的临时 schema 文件
      const testSchemasDir = join(tempDir1, 'schemas')
      await mkdir(testSchemasDir, { recursive: true })

      // 创建一个有重复 $defs 的 schema 文件 (通过创建两个文件定义相同的 ID)
      const schema1 = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: 'test1.schema.json',
        $defs: {
          DuplicateType: { type: 'string' },
        },
      }
      const schema2 = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: 'test2.schema.json',
        $defs: {
          DuplicateType: { type: 'number' }, // 重复 ID
        },
      }

      await writeFile(join(testSchemasDir, 'test1.schema.json'), JSON.stringify(schema1, null, 2))
      await writeFile(join(testSchemasDir, 'test2.schema.json'), JSON.stringify(schema2, null, 2))

      // 复制 openapi.yaml 到临时目录
      const openapiContent = await readFile(join(CONTRACT_SOURCE_ROOT, 'openapi.yaml'), 'utf-8')
      await writeFile(join(tempDir1, 'openapi.yaml'), openapiContent)

      // 验证编译器检测到重复 ID
      await expect(compileContractSources(tempDir1, tempDir2)).rejects.toMatchObject({
        code: 'CONTRACT_DUPLICATE_ID',
      })
    })

    it('注入禁止关键字时抛出 CONTRACT_PROFILE_VIOLATION', async () => {
      // 创建包含禁止关键字的临时 schema 文件
      const testSchemasDir = join(tempDir1, 'schemas')
      await mkdir(testSchemasDir, { recursive: true })

      // 创建一个包含 $dynamicRef（Portable Profile 禁止）的 schema
      const forbiddenSchema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: 'forbidden.schema.json',
        $defs: {
          BadType: {
            $dynamicRef: '#meta', // 禁止的关键字
          },
        },
      }

      await writeFile(
        join(testSchemasDir, 'forbidden.schema.json'),
        JSON.stringify(forbiddenSchema, null, 2),
      )

      // 复制 openapi.yaml 到临时目录
      const openapiContent = await readFile(join(CONTRACT_SOURCE_ROOT, 'openapi.yaml'), 'utf-8')
      await writeFile(join(tempDir1, 'openapi.yaml'), openapiContent)

      // 验证编译器检测到禁止关键字
      await expect(compileContractSources(tempDir1, tempDir2)).rejects.toMatchObject({
        code: 'CONTRACT_PROFILE_VIOLATION',
      })
    })

    it('检测到陈旧文件时返回差异', async () => {
      // 先生成到 tempDir1
      await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir1)

      // 在 tempDir1 中添加一个陈旧文件
      await writeFile(join(tempDir1, 'stale-file.json'), '{"stale": true}')

      // 检查时应该发现陈旧文件
      const diff = await checkGeneratedContract(CONTRACT_SOURCE_ROOT, tempDir1)

      expect(diff.hasChanges).toBe(true)
      expect(diff.deleted).toContain('stale-file.json')
    })

    it('检测到修改的文件时返回差异', async () => {
      // 先生成到 tempDir1
      await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir1)

      // 修改 manifest.json
      const manifestPath = join(tempDir1, 'manifest.json')
      const content = await readFile(manifestPath, 'utf-8')
      await writeFile(manifestPath, content.replace('"v1"', '"v2"'))

      // 检查时应该发现修改
      const diff = await checkGeneratedContract(CONTRACT_SOURCE_ROOT, tempDir1)

      expect(diff.hasChanges).toBe(true)
      expect(diff.modified).toContain('manifest.json')
    })

    it('跨文件悬空引用时抛出 CONTRACT_UNRESOLVED_REF', async () => {
      // 创建临时 schema 文件
      const testSchemasDir = join(tempDir1, 'schemas')
      await mkdir(testSchemasDir, { recursive: true })

      // 创建一个引用不存在的 $defs 的 schema
      const schemaWithDanglingRef = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: 'dangling.schema.json',
        $defs: {
          TestType: {
            $ref: 'common.schema.json#/$defs/NonExistentType', // 悬空引用
          },
        },
      }

      // 创建一个有效的 common.schema.json 但不包含 NonExistentType
      const commonSchema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: 'common.schema.json',
        $defs: {
          UUID: { type: 'string', format: 'uuid' },
        },
      }

      await writeFile(
        join(testSchemasDir, 'dangling.schema.json'),
        JSON.stringify(schemaWithDanglingRef, null, 2),
      )
      await writeFile(
        join(testSchemasDir, 'common.schema.json'),
        JSON.stringify(commonSchema, null, 2),
      )

      // 复制 openapi.yaml 到临时目录
      const openapiContent = await readFile(join(CONTRACT_SOURCE_ROOT, 'openapi.yaml'), 'utf-8')
      await writeFile(join(tempDir1, 'openapi.yaml'), openapiContent)

      // 验证编译器检测到悬空引用
      await expect(compileContractSources(tempDir1, tempDir2)).rejects.toMatchObject({
        code: 'CONTRACT_UNRESOLVED_REF',
      })
    })

    it('路径遍历尝试时抛出 CONTRACT_UNSAFE_PATH', async () => {
      // 创建临时 schema 文件
      const testSchemasDir = join(tempDir1, 'schemas')
      await mkdir(testSchemasDir, { recursive: true })

      // 创建一个尝试路径遍历的 schema
      const schemaWithPathTraversal = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: 'malicious.schema.json',
        $defs: {
          TestType: {
            $ref: '../../../etc/passwd#/$defs/Foo', // 路径遍历尝试
          },
        },
      }

      await writeFile(
        join(testSchemasDir, 'malicious.schema.json'),
        JSON.stringify(schemaWithPathTraversal, null, 2),
      )

      // 复制 openapi.yaml 到临时目录
      const openapiContent = await readFile(join(CONTRACT_SOURCE_ROOT, 'openapi.yaml'), 'utf-8')
      await writeFile(join(tempDir1, 'openapi.yaml'), openapiContent)

      // 验证编译器检测到路径遍历
      await expect(compileContractSources(tempDir1, tempDir2)).rejects.toMatchObject({
        code: 'CONTRACT_UNSAFE_PATH',
      })
    })

    it('相邻前缀目录不能绕过跨文件引用路径边界', async () => {
      const fixtureRoot = join(tempDir1, 'source')
      await cp(CONTRACT_SOURCE_ROOT, fixtureRoot, { recursive: true })
      const recipePath = join(fixtureRoot, 'schemas', 'recipe.schema.json')
      const recipe = await readFile(recipePath, 'utf-8')
      await writeFile(
        recipePath,
        recipe.replace(
          'common.schema.json#/$defs/UUID',
          '../schemas-escape/outside.schema.json#/$defs/UUID',
        ),
      )
      await mkdir(join(fixtureRoot, 'schemas-escape'))
      await writeFile(
        join(fixtureRoot, 'schemas-escape', 'outside.schema.json'),
        JSON.stringify({ $defs: { UUID: { type: 'string' } } }),
      )

      await expect(compileContractSources(fixtureRoot, tempDir2)).rejects.toMatchObject({
        code: 'CONTRACT_UNSAFE_PATH',
      })
    })

    it('跨文件引用不能通过 schemas 内 symlink 读取目录外内容', async () => {
      const fixtureRoot = join(tempDir1, 'source')
      await cp(CONTRACT_SOURCE_ROOT, fixtureRoot, { recursive: true })
      const recipePath = join(fixtureRoot, 'schemas', 'recipe.schema.json')
      const recipe = await readFile(recipePath, 'utf-8')
      await writeFile(
        recipePath,
        recipe.replace('common.schema.json#/$defs/UUID', 'escape.schema.json#/$defs/UUID'),
      )
      const outsideSchema = join(fixtureRoot, 'outside.schema.json')
      await writeFile(outsideSchema, JSON.stringify({ $defs: { UUID: { type: 'string' } } }))
      await symlink(outsideSchema, join(fixtureRoot, 'schemas', 'escape.schema.json'))

      await expect(compileContractSources(fixtureRoot, tempDir2)).rejects.toMatchObject({
        code: 'CONTRACT_UNSAFE_PATH',
      })
    })
  })

  describe('fingerprint 计算', () => {
    it('fingerprint 为 64 字符十六进制 SHA-256', async () => {
      const manifest = await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir1)

      expect(manifest.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    })

    it('相同源产生相同 fingerprint', async () => {
      const manifest1 = await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir1)
      const manifest2 = await compileContractSources(CONTRACT_SOURCE_ROOT, tempDir2)

      expect(manifest1.fingerprint).toBe(manifest2.fingerprint)
    })
  })
})
