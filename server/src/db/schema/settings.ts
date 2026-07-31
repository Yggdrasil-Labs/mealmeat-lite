import { sql } from 'drizzle-orm'
import { bigint, check, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const settings = pgTable(
  'settings',
  {
    key: text('key').primaryKey(),
    value: jsonb('value').$type<unknown>().notNull(),
    valueSchemaVersion: integer('value_schema_version').notNull(),
    serverVersion: bigint('server_version', { mode: 'bigint' }).notNull().unique(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('settings_key_check', sql`${table.key} = 'familyPreference'`),
    check('settings_value_schema_version_check', sql`${table.valueSchemaVersion} >= 1`),
  ],
)
