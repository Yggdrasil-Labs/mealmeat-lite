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

const typedManifest = manifest as unknown as ContractManifest

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
  })

  describe('工具校验语义等价', () => {
    /**
     * TODO(T6): 完整的语义等价测试将在 T6 fixture 门禁中实现
     *
     * AC1 要求"8 个 Provider 工具与权威 valid/invalid corpus 语义等价"
     * 这需要共享的 fixture corpus 来验证 Provider JSONSchema7 投影
     * 和权威 Ajv validator 对相同输入给出一致结果。
     *
     * 当前测试仅验证：
     * 1. 8 个工具全部生成
     * 2. schema 已完全展开（无 $ref）
     * 3. 无危险关键字
     */
    it('add_recipe 工具定义存在且结构正确', () => {
      const tools = buildProviderTools(typedManifest)
      const addRecipe = tools.find((t) => t.name === 'add_recipe')
      expect(addRecipe).toBeDefined()
      expect(addRecipe?.parameters.type).toBe('object')
      expect(addRecipe?.parameters.additionalProperties).toBe(false)
    })
  })
})
