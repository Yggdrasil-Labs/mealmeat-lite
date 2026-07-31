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
})
