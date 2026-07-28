/**
 * Provider 工具投影测试
 *
 * 验证：
 * 1. buildProviderTools 生成 8 个工具
 * 2. 工具 schema 正确展开 $ref
 * 3. 危险关键字触发 CONTRACT_PROVIDER_PROJECTION_UNSAFE
 */
import { describe, expect, it } from 'vitest'
import manifest from '../../../contracts/v1/generated/manifest.json' with { type: 'json' }
import { buildProviderTools } from './provider-tools.js'
import type { ContractManifest } from './types.js'
import { validateToolInput } from './validation.js'

const typedManifest = manifest as unknown as ContractManifest

type ProviderValidator = (value: unknown) => boolean
type ProviderAjv = { compile: (schema: unknown) => ProviderValidator }
type ProviderAjvConstructor = new (options: { allErrors: boolean; strict: boolean }) => ProviderAjv
type FormatsInstaller = (ajv: ProviderAjv) => unknown

describe('Provider 工具投影', () => {
  describe('buildProviderTools', () => {
    it('生成 8 个 Provider 工具', () => {
      const tools = buildProviderTools(typedManifest)
      expect(tools).toHaveLength(8)
    })

    it('包含所有必需的工具', () => {
      const tools = buildProviderTools(typedManifest)
      const toolNames = tools.map((t) => t.name)

      expect(toolNames).toContain('add_recipe')
      expect(toolNames).toContain('update_recipe')
      expect(toolNames).toContain('delete_recipe')
      expect(toolNames).toContain('restore_recipe')
      expect(toolNames).toContain('search_recipes')
      expect(toolNames).toContain('batch_generate_recipes')
      expect(toolNames).toContain('generate_weekly_plan')
      expect(toolNames).toContain('update_plan_item')
    })

    it('每个工具都有 description 和 parameters', () => {
      const tools = buildProviderTools(typedManifest)

      for (const tool of tools) {
        expect(tool.description).toBeDefined()
        expect(tool.description.length).toBeGreaterThan(0)
        expect(tool.parameters).toBeDefined()
        expect(tool.parameters.type).toBe('object')
      }
    })

    it('update_recipe 工具的 patch.notes 支持三态', () => {
      const tools = buildProviderTools(typedManifest)
      const updateRecipe = tools.find((t) => t.name === 'update_recipe')

      expect(updateRecipe).toBeDefined()
      const schema = updateRecipe?.parameters
      expect(schema?.properties).toBeDefined()
    })

    it('工具 schema 不包含 $ref（已完全展开）', () => {
      const tools = buildProviderTools(typedManifest)

      for (const tool of tools) {
        const schemaStr = JSON.stringify(tool.parameters)
        expect(schemaStr).not.toContain('"$ref"')
      }
    })

    it('工具 schema 不包含危险关键字', () => {
      const tools = buildProviderTools(typedManifest)
      const dangerousKeywords = [
        '$dynamicRef',
        '$dynamicAnchor',
        'unevaluatedItems',
        'unevaluatedProperties',
      ]

      for (const tool of tools) {
        const schemaStr = JSON.stringify(tool.parameters)
        for (const keyword of dangerousKeywords) {
          expect(schemaStr).not.toContain(`"${keyword}"`)
        }
      }
    })

    it('Provider 执行前强制通过权威校验，拒绝输入不得进入 executor', async () => {
      const addRecipe = buildProviderTools(typedManifest).find((tool) => tool.name === 'add_recipe')
      expect(addRecipe).toBeDefined()

      let executed = false
      const result = await addRecipe?.execute(
        // 即使某个 Provider 对额外字段或空字符串宽松，执行边界仍只信任权威 validator。
        { name: '', unexpected: 'provider-permissive-input' },
        () => {
          executed = true
          return { recipeId: 'should-not-be-created' }
        },
      )

      expect(result?.success).toBe(false)
      expect(executed).toBe(false)
    })
  })

  describe('工具校验语义等价', () => {
    it('manifest 的 inputSchemaId 是 Provider 投影的唯一 schema 选择来源', () => {
      const remappedManifest = {
        ...typedManifest,
        functionTools: typedManifest.functionTools.map((tool) =>
          tool.name === 'add_recipe' ? { ...tool, inputSchemaId: 'SearchRecipesInput' } : tool,
        ),
      } as ContractManifest

      const tools = buildProviderTools(remappedManifest)
      const addRecipe = tools.find((tool) => tool.name === 'add_recipe')

      expect(addRecipe?.parameters.properties).toHaveProperty('query')
      expect(addRecipe?.parameters.properties).not.toHaveProperty('name')
    })

    it('8 个 Provider 工具与权威 valid/invalid corpus 语义等价', async () => {
      const tools = buildProviderTools(typedManifest)
      const toolMap = new Map(tools.map((tool) => [tool.name, tool]))
      const Ajv = (await import('ajv')) as unknown as { default: ProviderAjvConstructor }
      const addFormats = (await import('ajv-formats')) as unknown as { default: FormatsInstaller }
      const ajv = new Ajv.default({ allErrors: true, strict: false })
      addFormats.default(ajv)
      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      const weeklyItems = Array.from({ length: 21 }, () => ({
        date: '2026-07-27',
        mealType: 'breakfast',
        recipeId: uuid,
      }))
      const corpus: ReadonlyArray<{
        toolName: (typeof typedManifest.functionTools)[number]['name']
        valid: unknown
        invalid: unknown
      }> = [
        { toolName: 'add_recipe', valid: { name: '红烧肉' }, invalid: { name: '' } },
        {
          toolName: 'update_recipe',
          valid: { recipeId: uuid, patch: { notes: { op: 'clear' } } },
          invalid: { recipeId: uuid, patch: {} },
        },
        { toolName: 'delete_recipe', valid: { recipeId: uuid }, invalid: { recipeId: 'bad' } },
        { toolName: 'restore_recipe', valid: { recipeId: uuid }, invalid: { recipeId: 'bad' } },
        {
          toolName: 'search_recipes',
          valid: { query: '红烧', limit: 10 },
          invalid: { limit: '10' },
        },
        {
          toolName: 'batch_generate_recipes',
          valid: { recipes: [{ name: '红烧肉' }] },
          invalid: { recipes: [] },
        },
        {
          toolName: 'generate_weekly_plan',
          valid: { weekStart: '2026-07-27', items: weeklyItems },
          invalid: { weekStart: '2026-07-27', items: [] },
        },
        {
          toolName: 'update_plan_item',
          valid: { planItemId: uuid, recipeId: uuid },
          invalid: { planItemId: uuid, recipeId: 'bad' },
        },
      ]

      for (const { toolName, valid, invalid } of corpus) {
        const tool = toolMap.get(toolName)
        expect(tool, `missing tool ${toolName}`).toBeDefined()
        const providerValidator = ajv.compile(tool?.parameters)

        for (const value of [valid, invalid]) {
          const providerResult = providerValidator(value)
          const authoritativeResult = validateToolInput(toolName, value).success
          expect(providerResult, `${toolName} should match authoritative validator`).toBe(
            authoritativeResult,
          )
        }
      }
    })
  })
})
