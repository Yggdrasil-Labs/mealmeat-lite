import type { PlanItemRow, WeeklyPlanRow } from '../../db/schema/plans.js'
import type { WeeklyPlanView } from '../generated/schemas.js'
import { validateContract } from '../validation.js'
import { ContractMapperError } from './recipe.js'

const mealTypes = ['breakfast', 'lunch', 'dinner'] as const

function isoDateAtOffset(weekStart: string, offset: number): string {
  const date = new Date(`${weekStart}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

function assertCompleteWeeklyPlan(
  weekStart: string,
  items: readonly Pick<PlanItemRow, 'date' | 'mealType'>[],
): void {
  const expectedSlots = new Set(
    Array.from({ length: 7 }, (_, dayOffset) =>
      mealTypes.map((mealType) => `${isoDateAtOffset(weekStart, dayOffset)}:${mealType}`),
    ).flat(),
  )
  const actualSlots = new Set(items.map((item) => `${item.date}:${item.mealType}`))
  if (
    actualSlots.size !== expectedSlots.size ||
    items.length !== expectedSlots.size ||
    [...actualSlots].some((slot) => !expectedSlots.has(slot))
  ) {
    throw new ContractMapperError('Weekly plan must cover every meal slot in its week')
  }
}

export function weeklyPlanRowsToContract(
  plan: WeeklyPlanRow,
  items: readonly PlanItemRow[],
): WeeklyPlanView {
  assertCompleteWeeklyPlan(plan.weekStart, items)
  const value = {
    id: plan.id,
    weekStart: plan.weekStart,
    serverVersion: plan.serverVersion.toString(),
    items: items.map((item) => ({
      id: item.id,
      date: item.date,
      mealType: item.mealType,
      recipeId: item.recipeId,
      recipeNameSnapshot: item.recipeNameSnapshot,
    })),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  }
  const result = validateContract('WeeklyPlanView', value)
  if (!result.success) {
    throw new ContractMapperError(`Contract validation failed for WeeklyPlanView: ${result.error}`)
  }
  return result.value
}
