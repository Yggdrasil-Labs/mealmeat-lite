import type { PublicSchemaId } from '../generated/schemas.js'
import { validateContract } from '../validation.js'

export type VersionedJsonbKind =
  | 'conversation.messages'
  | 'settings.value'
  | 'pending_confirmation.draft_payload.recipe_batch'
  | 'pending_confirmation.draft_payload.weekly_plan_replace'
  | 'pending_confirmation.result'
  | 'chat_request_receipt.tool_receipts'
  | 'sync_action_receipt.result'
  | 'sync_change.recipe.upsert'
  | 'sync_change.recipe.delete'
  | 'sync_change.weekly_plan.upsert'
  | 'sync_change.settings.upsert'

export type ValidatedJsonbPayload = unknown

export class VersionedJsonbError extends Error {
  readonly code: 'UNKNOWN_SCHEMA_VERSION' | 'CONTRACT_VALIDATION_FAILED'

  constructor(code: VersionedJsonbError['code'], message: string) {
    super(message)
    this.code = code
  }
}

const schemaByKind: Readonly<Record<VersionedJsonbKind, PublicSchemaId>> = {
  'conversation.messages': 'ChatHistoryResponse',
  'settings.value': 'SettingsDto',
  'pending_confirmation.draft_payload.recipe_batch': 'RecipeBatchPreview',
  'pending_confirmation.draft_payload.weekly_plan_replace': 'WeeklyPlanPreview',
  'pending_confirmation.result': 'ConfirmationCommitResultDto',
  'chat_request_receipt.tool_receipts': 'SyncActionResultDto',
  'sync_action_receipt.result': 'SyncActionResultDto',
  'sync_change.recipe.upsert': 'SyncChangeDto',
  'sync_change.recipe.delete': 'SyncChangeDto',
  'sync_change.weekly_plan.upsert': 'SyncChangeDto',
  'sync_change.settings.upsert': 'SyncChangeDto',
}

/**
 * JSONB readers must select a schema by both stable storage kind and version.
 * v0.1 deliberately has exactly one accepted version per carrier; future
 * migrations add a new explicit branch instead of silently accepting it.
 */
export function validateVersionedJsonb(
  kind: VersionedJsonbKind,
  schemaVersion: number,
  payload: unknown,
): ValidatedJsonbPayload {
  if (schemaVersion !== 1) {
    throw new VersionedJsonbError(
      'UNKNOWN_SCHEMA_VERSION',
      `Unknown JSONB schema version ${schemaVersion} for ${kind}`,
    )
  }

  const candidate =
    kind === 'settings.value' ? { key: 'familyPreference', value: payload } : payload
  const result = validateContract(schemaByKind[kind], candidate)
  if (!result.success) {
    throw new VersionedJsonbError(
      'CONTRACT_VALIDATION_FAILED',
      `Invalid JSONB payload for ${kind}: ${result.error}`,
    )
  }
  return payload
}
