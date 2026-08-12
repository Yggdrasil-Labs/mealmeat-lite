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
import { schemaLocations, toolInputSchemaLocations } from './generated/schemas.js'
import { getValidator } from './generated/validators.js'
import type { ContractValidationResult } from './types.js'

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
  const loc = toolInputSchemaLocations[toolName]
  if (!loc) {
    return {
      success: false,
      code: 'UNKNOWN_TOOL',
      error: `Unknown function tool: ${toolName}`,
    }
  }

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
