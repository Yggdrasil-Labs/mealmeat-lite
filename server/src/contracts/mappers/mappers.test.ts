import { describe, expect, it } from 'vitest'
import { recipeContractToInsert, recipeRowToContract } from './recipe.js'
import { syncChangeRowToContract } from './sync.js'
import { validateVersionedJsonb } from './versioned-jsonb.js'

const id = '13b3ad2e-ef4c-420d-b67c-474b4f33fa7e'
const recipe = {
  id,
  name: '番茄鸡蛋面',
  tags: ['快手'],
  ingredients: ['番茄', '鸡蛋'],
  steps: ['煮面'],
  serverVersion: '1',
  createdAt: '2026-07-26T00:00:00.000Z',
  updatedAt: '2026-07-26T00:00:00.000Z',
}

const plan = {
  id,
  weekStart: '2026-07-27',
  serverVersion: '2',
  items: Array.from({ length: 21 }, (_, index) => ({
    id: `13b3ad2e-ef4c-420d-b67c-${String(index).padStart(12, '0')}`,
    date: '2026-07-27',
    mealType: 'breakfast',
    recipeId: id,
    recipeNameSnapshot: '番茄鸡蛋面',
  })),
  createdAt: '2026-07-26T00:00:00.000Z',
  updatedAt: '2026-07-26T00:00:00.000Z',
}

const syncResult = {
  actionId: id,
  status: 'rejected',
  errCode: 'BAD_REQUEST',
  errMessage: 'bad',
  requiresFullResync: true,
}

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
      recipeContractToInsert(
        { name: '', unknown: true } as unknown as Parameters<typeof recipeContractToInsert>[0],
        1n,
      )
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

  it('validates stored Settings JSONB directly instead of wrapping it a second time', () => {
    expect(
      validateVersionedJsonb('settings.value', 1, { key: 'familyPreference', value: '清淡' }),
    ).toEqual({
      key: 'familyPreference',
      value: '清淡',
    })
  })

  it('projects a stored recipe upsert payload into the enclosing SyncChange DTO', () => {
    expect(
      syncChangeRowToContract({
        serverVersion: 1n,
        resource: 'recipe',
        operation: 'upsert',
        payload: recipe,
        payloadSchemaVersion: 1,
        createdAt: new Date('2026-07-26T00:00:00.000Z'),
      }),
    ).toMatchObject({ resource: 'recipe', operation: 'upsert', data: recipe })
  })

  it('validates one stored payload vector for each of the seven JSONB carriers', () => {
    const vectors = [
      ['conversation.messages', { messages: [] }],
      ['settings.value', { key: 'familyPreference', value: '清淡' }],
      [
        'pending_confirmation.draft_payload.recipe_batch',
        { items: [{ name: '番茄鸡蛋面' }], skippedDuplicates: [] },
      ],
      [
        'pending_confirmation.result',
        {
          kind: 'recipe_batch',
          changes: [{ serverVersion: '1', resource: 'recipe', operation: 'upsert', data: recipe }],
        },
      ],
      ['chat_request_receipt.tool_receipts', syncResult],
      ['sync_action_receipt.result', syncResult],
      ['sync_change.weekly_plan.upsert', plan],
    ] as const

    for (const [kind, payload] of vectors) {
      expect(validateVersionedJsonb(kind, 1, payload)).toEqual(payload)
    }
  })

  it('maps a plan sync payload without attempting to validate it as an enclosing SyncChange first', () => {
    expect(
      syncChangeRowToContract({
        serverVersion: 2n,
        resource: 'weekly_plan',
        operation: 'upsert',
        payload: plan,
        payloadSchemaVersion: 1,
        createdAt: new Date('2026-07-26T00:00:00.000Z'),
      }),
    ).toMatchObject({ resource: 'weekly_plan', data: plan })
  })
})
