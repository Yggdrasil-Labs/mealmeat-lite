import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { deviceTokens } from './auth.js'

export const conversations = pgTable(
  'conversations',
  {
    deviceId: uuid('device_id')
      .primaryKey()
      .references(() => deviceTokens.id, { onDelete: 'restrict' }),
    messages: jsonb('messages').$type<unknown>().notNull(),
    messagesSchemaVersion: integer('messages_schema_version').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('conversations_messages_schema_version_check', sql`${table.messagesSchemaVersion} >= 1`),
    check(
      'conversations_messages_limit_check',
      sql`CASE WHEN jsonb_typeof(${table.messages} -> 'messages') = 'array' THEN jsonb_array_length(${table.messages} -> 'messages') <= 40 ELSE false END`,
    ),
  ],
)

export const chatRequestReceipts = pgTable(
  'chat_request_receipts',
  {
    deviceId: uuid('device_id')
      .notNull()
      .references(() => deviceTokens.id, { onDelete: 'restrict' }),
    chatRequestId: uuid('chat_request_id').notNull(),
    requestHash: text('request_hash').notNull(),
    modelId: varchar('model_id', { length: 100 }),
    message: text('message'),
    status: varchar('status', { length: 16 }).notNull(),
    retryable: boolean('retryable').default(false).notNull(),
    leaseOwner: uuid('lease_owner'),
    leaseGeneration: integer('lease_generation').default(1).notNull(),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    heartbeatAt: timestamp('heartbeat_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').default(1).notNull(),
    toolReceipts: jsonb('tool_receipts').$type<unknown>(),
    toolReceiptsSchemaVersion: integer('tool_receipts_schema_version'),
    finalResponse: text('final_response'),
    errorCode: varchar('error_code', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.deviceId, table.chatRequestId] }),
    index('chat_request_receipts_device_status_lease_idx').on(
      table.deviceId,
      table.status,
      table.leaseExpiresAt,
    ),
    check(
      'chat_request_receipts_request_hash_format_check',
      sql`${table.requestHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      'chat_request_receipts_status_check',
      sql`${table.status} in ('running', 'completed', 'failed', 'expired')`,
    ),
    check('chat_request_receipts_lease_generation_check', sql`${table.leaseGeneration} >= 1`),
    check('chat_request_receipts_attempt_count_check', sql`${table.attemptCount} >= 1`),
    check(
      'chat_request_receipts_tool_receipts_schema_version_check',
      sql`${table.toolReceiptsSchemaVersion} IS NULL OR ${table.toolReceiptsSchemaVersion} >= 1`,
    ),
    check(
      'chat_request_receipts_tool_receipts_version_pair_check',
      sql`(${table.toolReceipts} IS NULL) = (${table.toolReceiptsSchemaVersion} IS NULL)`,
    ),
    check(
      'chat_request_receipts_lease_check',
      sql`CASE WHEN ${table.status} = 'running' THEN ${table.leaseOwner} IS NOT NULL AND ${table.leaseExpiresAt} IS NOT NULL AND ${table.heartbeatAt} IS NOT NULL AND ${table.leaseExpiresAt} >= ${table.heartbeatAt} AND ${table.leaseExpiresAt} <= ${table.heartbeatAt} + interval '30 seconds' ELSE ${table.leaseOwner} IS NULL AND ${table.leaseExpiresAt} IS NULL AND ${table.heartbeatAt} IS NULL END`,
    ),
    check(
      'chat_request_receipts_terminal_state_check',
      sql`CASE WHEN ${table.status} = 'running' THEN ${table.modelId} IS NOT NULL AND ${table.message} IS NOT NULL AND ${table.finalResponse} IS NULL AND ${table.errorCode} IS NULL WHEN ${table.status} = 'completed' THEN ${table.finalResponse} IS NOT NULL AND ${table.errorCode} IS NULL AND ${table.retryable} = false WHEN ${table.status} = 'failed' THEN ${table.finalResponse} IS NULL AND ${table.errorCode} IS NOT NULL WHEN ${table.status} = 'expired' THEN ${table.modelId} IS NULL AND ${table.message} IS NULL AND ${table.toolReceipts} IS NULL AND ${table.finalResponse} IS NULL AND ${table.errorCode} IS NULL AND ${table.retryable} = false ELSE false END`,
    ),
  ],
)

export const pendingConfirmations = pgTable(
  'pending_confirmations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => deviceTokens.id, { onDelete: 'restrict' }),
    chatRequestId: uuid('chat_request_id').notNull(),
    toolIndex: integer('tool_index').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    kind: varchar('kind', { length: 32 }).notNull(),
    state: varchar('state', { length: 16 }).notNull(),
    draftPayload: jsonb('draft_payload').$type<unknown>().notNull(),
    draftSchemaVersion: integer('draft_schema_version').notNull(),
    targetResourceId: uuid('target_resource_id'),
    targetVersion: bigint('target_version', { mode: 'bigint' }),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    commitActionId: uuid('commit_action_id'),
    commitRequestHash: text('commit_request_hash'),
    result: jsonb('result').$type<unknown>(),
    resultSchemaVersion: integer('result_schema_version'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('pending_confirmations_device_request_tool_unique').on(
      table.deviceId,
      table.chatRequestId,
      table.toolIndex,
    ),
    index('pending_confirmations_device_kind_created_idx').on(
      table.deviceId,
      table.kind,
      table.createdAt,
    ),
    uniqueIndex('pending_confirmations_device_commit_action_idx')
      .on(table.deviceId, table.commitActionId)
      .where(sql`${table.commitActionId} IS NOT NULL`),
    check(
      'pending_confirmations_token_hash_format_check',
      sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check('pending_confirmations_tool_index_check', sql`${table.toolIndex} >= 0`),
    check(
      'pending_confirmations_kind_check',
      sql`${table.kind} in ('recipe_batch', 'weekly_plan_replace')`,
    ),
    check(
      'pending_confirmations_state_check',
      sql`${table.state} in ('pending', 'expired', 'superseded', 'consumed')`,
    ),
    check(
      'pending_confirmations_draft_schema_version_check',
      sql`${table.draftSchemaVersion} >= 1`,
    ),
    check(
      'pending_confirmations_result_version_pair_check',
      sql`(${table.result} IS NULL) = (${table.resultSchemaVersion} IS NULL)`,
    ),
    check(
      'pending_confirmations_result_schema_version_check',
      sql`${table.resultSchemaVersion} IS NULL OR ${table.resultSchemaVersion} >= 1`,
    ),
    check(
      'pending_confirmations_expiry_check',
      sql`${table.expiresAt} >= ${table.createdAt} AND ${table.expiresAt} <= ${table.createdAt} + interval '10 minutes'`,
    ),
    check(
      'pending_confirmations_target_version_pair_check',
      sql`(${table.targetResourceId} IS NULL) = (${table.targetVersion} IS NULL) AND (${table.targetVersion} IS NULL OR ${table.targetVersion} >= 1)`,
    ),
    check(
      'pending_confirmations_commit_pair_check',
      sql`(${table.commitActionId} IS NULL) = (${table.commitRequestHash} IS NULL)`,
    ),
    check(
      'pending_confirmations_commit_request_hash_format_check',
      sql`${table.commitRequestHash} IS NULL OR ${table.commitRequestHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      'pending_confirmations_state_timestamps_check',
      sql`CASE WHEN ${table.state} in ('pending', 'expired') THEN ${table.consumedAt} IS NULL AND ${table.supersededAt} IS NULL WHEN ${table.state} = 'superseded' THEN ${table.consumedAt} IS NULL AND ${table.supersededAt} IS NOT NULL WHEN ${table.state} = 'consumed' THEN ${table.consumedAt} IS NOT NULL AND ${table.supersededAt} IS NULL AND ${table.commitActionId} IS NOT NULL AND ${table.result} IS NOT NULL ELSE false END`,
    ),
    foreignKey({
      columns: [table.deviceId, table.chatRequestId],
      foreignColumns: [chatRequestReceipts.deviceId, chatRequestReceipts.chatRequestId],
      name: 'pending_confirmations_chat_receipt_fk',
    }).onDelete('restrict'),
  ],
)
