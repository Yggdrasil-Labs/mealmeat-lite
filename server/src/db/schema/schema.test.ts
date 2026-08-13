import { describe, expect, it } from 'vitest'
import * as schema from './index.js'

describe('v0.1 persistence schema', () => {
  it('exports exactly the twelve logical PostgreSQL entities', () => {
    expect([
      schema.recipes,
      schema.weeklyPlans,
      schema.planItems,
      schema.conversations,
      schema.settings,
      schema.authConfig,
      schema.deviceTokens,
      schema.pendingConfirmations,
      schema.chatRequestReceipts,
      schema.syncActionReceipts,
      schema.syncChanges,
      schema.authAttemptThrottles,
    ]).toHaveLength(12)
  })

  it('keeps a schema version beside every JSONB carrier', () => {
    const versionColumns = [
      schema.conversations.messagesSchemaVersion,
      schema.settings.valueSchemaVersion,
      schema.pendingConfirmations.draftSchemaVersion,
      schema.pendingConfirmations.resultSchemaVersion,
      schema.chatRequestReceipts.toolReceiptsSchemaVersion,
      schema.syncActionReceipts.resultSchemaVersion,
      schema.syncChanges.payloadSchemaVersion,
    ]

    expect(versionColumns).toHaveLength(7)
    expect(versionColumns.every((column) => column !== undefined)).toBe(true)
  })

  it('models the complete authentication, recovery, confirmation, and sync receipts', () => {
    const authColumns = schema.authConfig as unknown as Record<string, unknown>
    expect(authColumns).toHaveProperty('familyCodeVersion')
    expect(authColumns).toHaveProperty('initializedAt')
    expect(authColumns).not.toHaveProperty('bootstrapSecretHash')

    const chatColumns = schema.chatRequestReceipts as unknown as Record<string, unknown>
    for (const column of [
      'requestHash',
      'modelId',
      'message',
      'status',
      'retryable',
      'leaseOwner',
      'leaseGeneration',
      'leaseExpiresAt',
      'heartbeatAt',
      'attemptCount',
      'finalResponse',
      'errorCode',
    ]) {
      expect(chatColumns, column).toHaveProperty(column)
    }
    expect(chatColumns).not.toHaveProperty('id')

    const confirmationColumns = schema.pendingConfirmations as unknown as Record<string, unknown>
    for (const column of [
      'targetResourceId',
      'targetVersion',
      'consumedAt',
      'supersededAt',
      'commitActionId',
      'commitRequestHash',
    ]) {
      expect(confirmationColumns, column).toHaveProperty(column)
    }

    const actionColumns = schema.syncActionReceipts as unknown as Record<string, unknown>
    expect(actionColumns).toHaveProperty('actionType')
    expect(actionColumns).toHaveProperty('payloadHash')
    expect(actionColumns).toHaveProperty('serverVersion')

    const changeColumns = schema.syncChanges as unknown as Record<string, unknown>
    expect(changeColumns).toHaveProperty('resourceId')
  })
})
