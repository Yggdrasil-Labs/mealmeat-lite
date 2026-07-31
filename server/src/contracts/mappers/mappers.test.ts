import { describe, expect, it } from 'vitest'
import { recipeContractToInsert, recipeRowToContract } from './recipe.js'
import { validateVersionedJsonb } from './versioned-jsonb.js'

describe('contract mappers', () => {
  it('keeps bigint server versions exact when projecting a recipe row', () => {
    const result = recipeRowToContract({
      id: '13b3ad2e-ef4c-420d-b67c-474b4f33fa7e',
      name: '番茄鸡蛋面',
      tags: ['快手'],
      ingredients: ['番茄', '鸡蛋'],
      steps: ['煮面'],
      imageUrl: null,
      notes: null,
      deletedAt: null,
      serverVersion: 9_007_199_254_740_993n,
      createdAt: new Date('2026-07-26T00:00:00.000Z'),
      updatedAt: new Date('2026-07-26T00:00:00.000Z'),
    })

    expect(result).toMatchObject({
      id: '13b3ad2e-ef4c-420d-b67c-474b4f33fa7e',
      serverVersion: '9007199254740993',
    })
    expect(result).not.toHaveProperty('imageUrl')
  })

  it('validates an incoming recipe draft before converting it to a Drizzle insert row', () => {
    try {
      recipeContractToInsert({ name: '', unknown: true } as unknown as Parameters<
        typeof recipeContractToInsert
      >[0])
      throw new Error('expected recipe mapper to reject invalid draft')
    } catch (error) {
      expect(error).toMatchObject({ code: 'CONTRACT_VALIDATION_FAILED' })
    }
  })

  it('rejects an unknown versioned JSONB schema version', () => {
    try {
      validateVersionedJsonb('settings.value', 2, '家庭偏好')
      throw new Error('expected JSONB validator to reject unknown version')
    } catch (error) {
      expect(error).toMatchObject({ code: 'UNKNOWN_SCHEMA_VERSION' })
    }
  })
})
