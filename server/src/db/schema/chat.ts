import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
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
    check('conversations_messages_limit_check', sql`jsonb_array_length(${table.messages}) <= 40`),
  ],
)

export const chatRequestReceipts = pgTable(
  'chat_request_receipts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => deviceTokens.id, { onDelete: 'restrict' }),
    chatRequestId: uuid('chat_request_id').notNull(),
    generation: integer('generation').default(1).notNull(),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }).notNull(),
    toolReceipts: jsonb('tool_receipts').$type<unknown>().notNull(),
    toolReceiptsSchemaVersion: integer('tool_receipts_schema_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('chat_request_receipts_device_request_unique').on(table.deviceId, table.chatRequestId),
    check(
      'chat_request_receipts_tool_receipts_schema_version_check',
      sql`${table.toolReceiptsSchemaVersion} >= 1`,
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
      sql`${table.expiresAt} <= ${table.createdAt} + interval '10 minutes'`,
    ),
    foreignKey({
      columns: [table.deviceId, table.chatRequestId],
      foreignColumns: [chatRequestReceipts.deviceId, chatRequestReceipts.chatRequestId],
      name: 'pending_confirmations_chat_receipt_fk',
    }).onDelete('restrict'),
  ],
)
