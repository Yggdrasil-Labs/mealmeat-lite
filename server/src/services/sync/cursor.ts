/**
 * 同步 cursor — RFC 8785 payload + base64url + HMAC-SHA256
 *
 * 从 bootstrap secret 以独立 HKDF context 派生 key；
 * payload 是封闭联合，任何篡改（limit/phase/version/签名）都返回 null。
 */
import type { AppConfig } from '../../config.js'
import {
  decodeSignedCursor,
  deriveHmacKey,
  encodeSignedCursor,
  HKDF_CONTEXT_SYNC_CURSOR,
} from '../../security/crypto.js'

export interface SyncSnapshotCursorPayload {
  schemaVersion: 1
  phase: 'snapshot'
  watermark: string
  lastResource?: string
  lastResourceId?: string
  limit: number
}

export interface SyncIncrementalCursorPayload {
  schemaVersion: 1
  phase: 'incremental'
  lastServerVersion: string
  limit: number
}

export type SyncCursorPayload = SyncSnapshotCursorPayload | SyncIncrementalCursorPayload

const SNAPSHOT_ALLOWED_KEYS = new Set([
  'schemaVersion',
  'phase',
  'watermark',
  'lastResource',
  'lastResourceId',
  'limit',
])
const INCREMENTAL_ALLOWED_KEYS = new Set(['schemaVersion', 'phase', 'lastServerVersion', 'limit'])

function isNonNegativeIntegerString(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9]+$/.test(value)
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(record).every((key) => allowed.has(key))
}

function isValidLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100
}

function isSnapshotPayload(record: Record<string, unknown>): boolean {
  if (!hasOnlyKeys(record, SNAPSHOT_ALLOWED_KEYS)) return false
  if (!isNonNegativeIntegerString(record.watermark)) return false
  const hasLastResource = Object.hasOwn(record, 'lastResource')
  const hasLastResourceId = Object.hasOwn(record, 'lastResourceId')
  if (hasLastResource !== hasLastResourceId) return false
  if (hasLastResource && typeof record.lastResource !== 'string') return false
  if (hasLastResourceId && typeof record.lastResourceId !== 'string') return false
  return true
}

function isIncrementalPayload(record: Record<string, unknown>): boolean {
  if (!hasOnlyKeys(record, INCREMENTAL_ALLOWED_KEYS)) return false
  return isNonNegativeIntegerString(record.lastServerVersion)
}

export function isSyncCursorPayload(value: unknown): value is SyncCursorPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (record.schemaVersion !== 1 || !isValidLimit(record.limit)) return false
  if (record.phase === 'snapshot') return isSnapshotPayload(record)
  if (record.phase === 'incremental') return isIncrementalPayload(record)
  return false
}

export function syncCursorKey(config: AppConfig): Buffer {
  return deriveHmacKey(config.bootstrapSecret, HKDF_CONTEXT_SYNC_CURSOR)
}

export function encodeSyncCursor(payload: SyncCursorPayload, key: Uint8Array): string {
  return encodeSignedCursor(payload, key)
}

export function decodeSyncCursor(cursor: string, key: Uint8Array): SyncCursorPayload | null {
  return decodeSignedCursor(cursor, key, isSyncCursorPayload)
}
