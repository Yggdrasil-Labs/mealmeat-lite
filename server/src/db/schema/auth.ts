import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

const argon2idHashPattern =
  '^\\$argon2id\\$v=19\\$m=[1-9][0-9]*,t=[1-9][0-9]*,p=[1-9][0-9]*\\$[A-Za-z0-9+/]+={0,2}\\$[A-Za-z0-9+/]+={0,2}$'
const sha256HexPattern = '^[0-9a-f]{64}$'
const argon2idHashPatternSql = sql.raw(`'${argon2idHashPattern}'`)
const sha256HexPatternSql = sql.raw(`'${sha256HexPattern}'`)

/** Only password/token hashes are persisted; plaintext secrets never enter this schema. */
export const authConfig = pgTable(
  'auth_config',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    bootstrapSecretHash: text('bootstrap_secret_hash').notNull(),
    familyCodeHash: text('family_code_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('auth_config_singleton_check', sql`${table.singleton} = true`),
    check(
      'auth_config_bootstrap_secret_hash_format_check',
      sql`${table.bootstrapSecretHash} ~ ${argon2idHashPatternSql}`,
    ),
    check(
      'auth_config_family_code_hash_format_check',
      sql`${table.familyCodeHash} ~ ${argon2idHashPatternSql}`,
    ),
  ],
)

export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tokenHash: text('token_hash').notNull().unique(),
    deviceName: varchar('device_name', { length: 80 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'device_tokens_token_hash_format_check',
      sql`${table.tokenHash} ~ ${sha256HexPatternSql}`,
    ),
  ],
)

export const authAttemptThrottles = pgTable(
  'auth_attempt_throttles',
  {
    scope: varchar('scope', { length: 40 }).notNull(),
    sourceKeyHash: text('source_key_hash').notNull(),
    failureCount: integer('failure_count').default(0).notNull(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.sourceKeyHash] }),
    check('auth_attempt_throttles_failure_count_check', sql`${table.failureCount} >= 0`),
    check(
      'auth_attempt_throttles_source_key_hash_format_check',
      sql`${table.sourceKeyHash} ~ ${sha256HexPatternSql}`,
    ),
  ],
)
