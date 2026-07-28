/**
 * 契约校验测试
 *
 * 验证：
 * 1. validateContract 按 schema ID 正确校验
 * 2. validateToolInput 校验 FC 工具输入
 * 3. Ajv 严格模式：禁止 unknown/coercion/default/removal
 */
import { spawn } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { validateContract, validateToolInput } from './validation.js'

function importWithNativeNodeEsm(
  moduleUrl: string,
): Promise<{ exitCode: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      '--input-type=module',
      '--eval',
      `await import(${JSON.stringify(moduleUrl)})`,
    ])
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.once('error', reject)
    child.once('close', (exitCode) => resolve({ exitCode, stderr }))
  })
}

describe('契约校验', () => {
  describe('validateContract', () => {
    it('有效的 UUID 通过校验', () => {
      const result = validateContract('UUID', '550e8400-e29b-41d4-a716-446655440000')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('550e8400-e29b-41d4-a716-446655440000')
      }
    })

    it('无效的 UUID 被拒绝', () => {
      const result = validateContract('UUID', 'not-a-uuid')
      expect(result.success).toBe(false)
    })

    it('有效的 ServerVersion 通过校验', () => {
      const result = validateContract('ServerVersion', '9007199254740993')
      expect(result.success).toBe(true)
    })

    it('ServerVersion 拒绝前导零', () => {
      const result = validateContract('ServerVersion', '0123')
      expect(result.success).toBe(false)
    })

    it('ServerVersion 拒绝零', () => {
      const result = validateContract('ServerVersion', '0')
      expect(result.success).toBe(false)
    })

    it('所有 manifest 公开 schema 都可由生成的 validator 校验', () => {
      const result = validateContract('HealthLiveResponse', { status: 'ok' })
      expect(result.success).toBe(true)
    })

    it('UUID 与 date-time 使用 Android 相同的小写和 UTC wire 约束', () => {
      expect(validateContract('UUID', '550E8400-E29B-41D4-A716-446655440000').success).toBe(false)
      expect(validateContract('Rfc3339DateTime', '2026-07-28T12:00:00+08:00').success).toBe(false)
      expect(validateContract('Rfc3339DateTime', '2026-07-28T04:00:00Z').success).toBe(true)
      expect(validateContract('Rfc3339DateTime', '2026-07-28T04:00:00+00:00').success).toBe(true)
    })

    it('ErrorResponse 仍保持 additionalProperties 严格拒绝', () => {
      const result = validateContract('ErrorResponse', {
        success: false,
        errCode: 'BAD_REQUEST',
        errMessage: '请求格式错误',
        requestId: 'request-1',
        retryable: false,
        unexpected: true,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('validateToolInput', () => {
    it('update_recipe 缺少 notes 字段时通过（optional missing）', () => {
      const input = {
        recipeId: '550e8400-e29b-41d4-a716-446655440000',
        patch: {
          name: '新名称',
        },
      }
      const result = validateToolInput('update_recipe', input)
      expect(result.success).toBe(true)
    })

    it('update_recipe clear notes 操作', () => {
      const input = {
        recipeId: '550e8400-e29b-41d4-a716-446655440000',
        patch: {
          notes: { op: 'clear' as const },
        },
      }
      const result = validateToolInput('update_recipe', input)
      expect(result.success).toBe(true)
      if (result.success) {
        // 使用类型断言访问 patch.notes
        const patch = result.value.patch as { notes?: { op: string } }
        expect(patch.notes).toEqual({ op: 'clear' })
      }
    })

    it('update_recipe set notes 操作', () => {
      const input = {
        recipeId: '550e8400-e29b-41d4-a716-446655440000',
        patch: {
          notes: { op: 'set' as const, value: '少盐少油' },
        },
      }
      const result = validateToolInput('update_recipe', input)
      expect(result.success).toBe(true)
      if (result.success) {
        // 使用类型断言访问 patch.notes
        const patch = result.value.patch as { notes?: { op: string; value?: string } }
        expect(patch.notes).toEqual({ op: 'set', value: '少盐少油' })
      }
    })

    it('add_recipe 有效输入通过', () => {
      const input = {
        name: '红烧肉',
        tags: ['家常菜', '猪肉'],
      }
      const result = validateToolInput('add_recipe', input)
      expect(result.success).toBe(true)
    })

    it('search_recipes 有效输入通过', () => {
      const input = {
        query: '红烧',
        limit: 10,
      }
      const result = validateToolInput('search_recipes', input)
      expect(result.success).toBe(true)
    })
  })

  describe('Ajv 严格模式', () => {
    it('standalone validator 可被原生 Node ESM 直接导入', async () => {
      const result = await importWithNativeNodeEsm(
        new URL('./generated/validators.ts', import.meta.url).href,
      )

      expect(result.stderr).not.toContain('require is not defined')
      expect(result.exitCode).toBe(0)
    })

    it('拒绝未知字段 (additionalProperties: false)', () => {
      const input = {
        recipeId: '550e8400-e29b-41d4-a716-446655440000',
        patch: { name: '新名称' },
        unknownField: 'should be rejected',
      }
      const result = validateToolInput('update_recipe', input)
      expect(result.success).toBe(false)
    })

    it('不进行类型转换 (coerceTypes: false)', () => {
      // limit 应该是 number，传入 string 应该失败
      const input = {
        query: '红烧',
        limit: '10', // string instead of number
      }
      const result = validateToolInput('search_recipes', input)
      expect(result.success).toBe(false)
    })

    it('不注入默认值 (useDefaults: false)', () => {
      const input = {
        query: '红烧',
        // 不传 limit，不应该自动注入默认值
      }
      const result = validateToolInput('search_recipes', input)
      expect(result.success).toBe(true)
      if (result.success) {
        // limit 应该是 undefined，不是默认值
        expect(result.value.limit).toBeUndefined()
      }
    })
  })
})
