import type { NewRecipeRow, RecipeRow } from '../../db/schema/recipes.js'
import type { RecipeDraft, RecipeView } from '../generated/schemas.js'
import { validateContract } from '../validation.js'

export class ContractMapperError extends Error {
  readonly code = 'CONTRACT_VALIDATION_FAILED'
}

function assertContract<T>(schemaId: Parameters<typeof validateContract>[0], value: T): T {
  const result = validateContract(schemaId, value)
  if (!result.success) {
    throw new ContractMapperError(`Contract validation failed for ${schemaId}: ${result.error}`)
  }
  return result.value as T
}

export function recipeRowToContract(row: RecipeRow): RecipeView {
  const value = {
    id: row.id,
    name: row.name,
    tags: row.tags,
    ingredients: row.ingredients,
    steps: row.steps,
    ...(row.imageUrl === null ? {} : { imageUrl: row.imageUrl }),
    ...(row.notes === null ? {} : { notes: row.notes }),
    serverVersion: row.serverVersion.toString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
  return assertContract('RecipeView', value) as RecipeView
}

/**
 * Converts validated user input only. The transaction-side writer appends a
 * version from `SyncWriteContext.nextServerVersion()` before calling Drizzle.
 */
export function recipeContractToInsert(value: RecipeDraft): NewRecipeRow {
  const draft = assertContract('RecipeDraft', value) as RecipeDraft
  return {
    name: draft.name,
    tags: [...(draft.tags ?? [])],
    ingredients: [...(draft.ingredients ?? [])],
    steps: [...(draft.steps ?? [])],
    imageUrl: draft.imageUrl ?? null,
    notes: draft.notes ?? null,
  }
}
