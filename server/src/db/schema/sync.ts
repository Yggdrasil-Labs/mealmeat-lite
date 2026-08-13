import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { deviceTokens } from './auth.js'

export const syncActionReceipts = pgTable(
  'sync_action_receipts',
  {
    deviceId: uuid('device_id')
      .notNull()
      .references(() => deviceTokens.id, { onDelete: 'restrict' }),
    actionId: uuid('action_id').notNull(),
    actionType: varchar('action_type', { length: 32 }).notNull(),
    payloadHash: text('payload_hash').notNull(),
    status: varchar('status', { length: 16 }).notNull(),
    result: jsonb('result').$type<unknown>().notNull(),
    resultSchemaVersion: integer('result_schema_version').notNull(),
    serverVersion: bigint('server_version', { mode: 'bigint' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.deviceId, table.actionId] }),
    index('sync_action_receipts_created_at_idx').on(table.createdAt),
    check(
      'sync_action_receipts_action_type_check',
      sql`${table.actionType} in ('recipe.patch', 'recipe.delete')`,
    ),
    check(
      'sync_action_receipts_payload_hash_format_check',
      sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      'sync_action_receipts_result_schema_version_check',
      sql`${table.resultSchemaVersion} >= 1`,
    ),
    check('sync_action_receipts_status_check', sql`${table.status} in ('applied', 'rejected')`),
    check(
      'sync_action_receipts_server_version_check',
      sql`${table.serverVersion} IS NULL OR ${table.serverVersion} >= 1`,
    ),
  ],
)

export const syncChanges = pgTable(
  'sync_changes',
  {
    serverVersion: bigint('server_version', { mode: 'bigint' }).primaryKey(),
    resource: varchar('resource', { length: 32 }).notNull(),
    resourceId: text('resource_id').notNull(),
    operation: varchar('operation', { length: 32 }).notNull(),
    payload: jsonb('payload').$type<unknown>().notNull(),
    payloadSchemaVersion: integer('payload_schema_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sync_changes_resource_id_version_idx').on(
      table.resource,
      table.resourceId,
      table.serverVersion.desc(),
    ),
    check('sync_changes_server_version_positive_check', sql`${table.serverVersion} >= 1`),
    check('sync_changes_payload_schema_version_check', sql`${table.payloadSchemaVersion} >= 1`),
    check(
      'sync_changes_resource_operation_check',
      sql`(${table.resource}, ${table.operation}) in (('recipe', 'upsert'), ('recipe', 'delete'), ('weekly_plan', 'upsert'), ('settings', 'upsert'))`,
    ),
    check('sync_changes_payload_object_check', sql`jsonb_typeof(${table.payload}) = 'object'`),
    check(
      'sync_changes_resource_id_check',
      sql`CASE WHEN ${table.resource} = 'settings' THEN ${table.resourceId} = 'familyPreference' ELSE ${table.resourceId} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' END`,
    ),
  ],
)

export type SyncChangeRow = typeof syncChanges.$inferSelect
