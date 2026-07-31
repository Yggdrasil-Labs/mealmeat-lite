import type { PlanItemRow, WeeklyPlanRow } from '../../db/schema/plans.js'
import type { WeeklyPlanView } from '../generated/schemas.js'
import { validateContract } from '../validation.js'
import { ContractMapperError } from './recipe.js'

export function weeklyPlanRowsToContract(
  plan: WeeklyPlanRow,
  items: readonly PlanItemRow[],
): WeeklyPlanView {
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
