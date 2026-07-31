import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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
    status: varchar('status', { length: 16 }).notNull(),
    result: jsonb('result').$type<unknown>().notNull(),
    resultSchemaVersion: integer('result_schema_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.deviceId, table.actionId] }),
    check(
      'sync_action_receipts_result_schema_version_check',
      sql`${table.resultSchemaVersion} >= 1`,
    ),
    check('sync_action_receipts_status_check', sql`${table.status} in ('applied', 'rejected')`),
  ],
)

export const syncChanges = pgTable(
  'sync_changes',
  {
    serverVersion: bigint('server_version', { mode: 'bigint' }).primaryKey(),
    resource: varchar('resource', { length: 32 }).notNull(),
    operation: varchar('operation', { length: 32 }).notNull(),
    payload: jsonb('payload').$type<unknown>().notNull(),
    payloadSchemaVersion: integer('payload_schema_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('sync_changes_payload_schema_version_check', sql`${table.payloadSchemaVersion} >= 1`),
    check(
      'sync_changes_resource_operation_check',
      sql`(${table.resource}, ${table.operation}) in (('recipe', 'upsert'), ('recipe', 'delete'), ('weekly_plan', 'upsert'), ('settings', 'upsert'))`,
    ),
  ],
)

export type SyncChangeRow = typeof syncChanges.$inferSelect
