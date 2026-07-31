import { sql } from 'drizzle-orm'
import { bigint, check, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

/** Recipe is persisted separately from the public RecipeView wire DTO. */
export const recipes = pgTable(
  'recipes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    tags: text('tags').array().notNull(),
    ingredients: text('ingredients').array().notNull(),
    steps: text('steps').array().notNull(),
    imageUrl: text('image_url'),
    notes: text('notes'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    serverVersion: bigint('server_version', { mode: 'bigint' }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('recipes_deleted_at_idx').on(table.deletedAt),
    check('recipes_name_non_empty_check', sql`char_length(${table.name}) >= 1`),
    check('recipes_server_version_positive_check', sql`${table.serverVersion} >= 1`),
  ],
)

export type RecipeRow = typeof recipes.$inferSelect
/** Contract-mapped fields before the sync transaction assigns the version. */
export type NewRecipeRow = Omit<typeof recipes.$inferInsert, 'serverVersion'>
/** The row accepted by Drizzle once SyncWriteContext has allocated a version. */
export type VersionedRecipeInsertRow = typeof recipes.$inferInsert
