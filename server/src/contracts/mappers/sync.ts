import type { SyncChangeRow } from '../../db/schema/sync.js'
import type { SyncChangeDto } from '../generated/schemas.js'
import { validateContract } from '../validation.js'
import { ContractMapperError } from './recipe.js'
import { type VersionedJsonbKind, validateVersionedJsonb } from './versioned-jsonb.js'

function syncKind(row: SyncChangeRow): VersionedJsonbKind {
  const kind = `sync_change.${row.resource}.${row.operation}` as VersionedJsonbKind
  const known: readonly VersionedJsonbKind[] = [
    'sync_change.recipe.upsert',
    'sync_change.recipe.delete',
    'sync_change.weekly_plan.upsert',
    'sync_change.settings.upsert',
  ]
  if (!known.includes(kind)) {
    throw new ContractMapperError(`Unsupported SyncChange kind: ${row.resource}.${row.operation}`)
  }
  return kind
}

export function syncChangeRowToContract(row: SyncChangeRow): SyncChangeDto {
  const payload = validateVersionedJsonb(syncKind(row), row.payloadSchemaVersion, row.payload)
  const value = {
    serverVersion: row.serverVersion.toString(),
    resource: row.resource,
    operation: row.operation,
    data: payload,
  }
  const result = validateContract('SyncChangeDto', value)
  if (!result.success) {
    throw new ContractMapperError(`Contract validation failed for SyncChangeDto: ${result.error}`)
  }
  return result.value
}
