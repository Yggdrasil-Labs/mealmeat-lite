import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { recipes } from './recipes.js'

export const weeklyPlans = pgTable(
  'weekly_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weekStart: date('week_start').notNull().unique(),
    serverVersion: bigint('server_version', { mode: 'bigint' }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('weekly_plans_week_start_monday_check', sql`extract(isodow from ${table.weekStart}) = 1`),
  ],
)

export const planItems = pgTable(
  'plan_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weeklyPlanId: uuid('weekly_plan_id')
      .notNull()
      .references(() => weeklyPlans.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    mealType: varchar('meal_type', { length: 16 }).notNull(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'restrict' }),
    recipeNameSnapshot: text('recipe_name_snapshot').notNull(),
  },
  (table) => [
    unique('plan_items_plan_date_meal_type_unique').on(
      table.weeklyPlanId,
      table.date,
      table.mealType,
    ),
    index('plan_items_recipe_id_idx').on(table.recipeId),
    check('plan_items_meal_type_check', sql`${table.mealType} in ('breakfast', 'lunch', 'dinner')`),
  ],
)

export type WeeklyPlanRow = typeof weeklyPlans.$inferSelect
export type PlanItemRow = typeof planItems.$inferSelect
