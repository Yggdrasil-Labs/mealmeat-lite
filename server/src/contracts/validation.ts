/**
 * 契约校验
 *
 * 基于 Ajv 的严格校验器，使用生成的 validators 和 schemas
 */

import type { ErrorObject } from 'ajv'
import type {
  ContractType,
  FunctionToolName,
  PublicSchemaId,
  ToolInput,
} from './generated/schemas.js'
import { getValidator } from './generated/validators.js'
import type { ContractValidationResult } from './types.js'

/**
 * Schema 位置映射
 *
 * 当前仅注册阶段 1 所需的 8 个核心 schema。
 * manifest.json 中还有 60+ 个公开 schema，将在后续阶段按需扩展。
 * TODO: T6 fixture 门禁可能需要扩展此映射以覆盖更多 schema。
 */
const schemaLocations: Record<PublicSchemaId, { file: string; defPath: string }> = {
  UUID: { file: 'common.schema.json', defPath: '/$defs/UUID' },
  ServerVersion: { file: 'common.schema.json', defPath: '/$defs/ServerVersion' },
  Rfc3339DateTime: { file: 'common.schema.json', defPath: '/$defs/Rfc3339DateTime' },
  MondayDate: { file: 'common.schema.json', defPath: '/$defs/MondayDate' },
  RecipeView: { file: 'recipe.schema.json', defPath: '/$defs/RecipeView' },
  RecipeDraft: { file: 'recipe.schema.json', defPath: '/$defs/RecipeDraft' },
  RecipePatchRequest: { file: 'recipe.schema.json', defPath: '/$defs/RecipePatchRequest' },
  WeeklyPlanView: { file: 'plan.schema.json', defPath: '/$defs/WeeklyPlanView' },
}

/**
 * 工具输入 schema 映射
 *
 * 格式：{ file, defPath } 用于 Ajv getValidator 查找
 *
 * 注意：provider-tools.ts 中有类似的 toolInputLocations，格式为 { file, defName }
 * 两者信息相同，但表示方式不同：
 * - toolInputSchemas.defPath: '/$defs/AddRecipeInput' (JSON Pointer 格式)
 * - toolInputLocations.defName: 'AddRecipeInput' (纯名称)
 *
 * TODO: 考虑从 manifest.functionTools 动态派生，避免手工维护两份映射
 */
const toolInputSchemas: Record<FunctionToolName, { file: string; defPath: string }> = {
  add_recipe: { file: 'recipe.schema.json', defPath: '/$defs/AddRecipeInput' },
  update_recipe: { file: 'recipe.schema.json', defPath: '/$defs/UpdateRecipeInput' },
  delete_recipe: { file: 'recipe.schema.json', defPath: '/$defs/DeleteRecipeInput' },
  restore_recipe: { file: 'recipe.schema.json', defPath: '/$defs/RestoreRecipeInput' },
  search_recipes: { file: 'recipe.schema.json', defPath: '/$defs/SearchRecipesInput' },
  batch_generate_recipes: {
    file: 'recipe.schema.json',
    defPath: '/$defs/BatchGenerateRecipesInput',
  },
  generate_weekly_plan: { file: 'plan.schema.json', defPath: '/$defs/GenerateWeeklyPlanInput' },
  update_plan_item: { file: 'plan.schema.json', defPath: '/$defs/UpdatePlanItemInput' },
}

/**
 * 按 schema ID 校验
 *
 * Plan 要求签名：
 * validateContract<TSchemaId extends PublicSchemaId>(
 *   schemaId: TSchemaId,
 *   value: unknown
 * ): ContractValidationResult<ContractType<TSchemaId>>
 */
export function validateContract<TSchemaId extends PublicSchemaId>(
  schemaId: TSchemaId,
  value: unknown,
): ContractValidationResult<ContractType<TSchemaId>> {
  const loc = schemaLocations[schemaId]

  try {
    const validator = getValidator(loc.file, loc.defPath)
    if (validator(value)) {
      return { success: true, value: value as ContractType<TSchemaId> }
    }
    return {
      success: false,
      error: 'Validation failed',
      errors: validator.errors?.map((e: ErrorObject) => ({
        path: e.instancePath || '/',
        message: e.message || 'Unknown error',
      })),
    }
  } catch (err) {
    return { success: false, error: `Validation error: ${err}` }
  }
}

/**
 * 校验工具输入
 *
 * Plan 要求签名：
 * validateToolInput<TName extends FunctionToolName>(
 *   toolName: TName,
 *   input: unknown
 * ): ContractValidationResult<ToolInput<TName>>
 */
export function validateToolInput<TName extends FunctionToolName>(
  toolName: TName,
  input: unknown,
): ContractValidationResult<ToolInput<TName>> {
  const loc = toolInputSchemas[toolName]

  try {
    const validator = getValidator(loc.file, loc.defPath)
    if (validator(input)) {
      return { success: true, value: input as ToolInput<TName> }
    }
    return {
      success: false,
      error: 'Validation failed',
      errors: validator.errors?.map((e: ErrorObject) => ({
        path: e.instancePath || '/',
        message: e.message || 'Unknown error',
      })),
    }
  } catch (err) {
    return { success: false, error: `Validation error: ${err}` }
  }
}

export type {
  ContractType,
  FunctionToolName,
  PublicSchemaId,
  ToolInput,
} from './generated/schemas.js'
// Re-export types for convenience
export type { ContractValidationResult } from './types.js'
