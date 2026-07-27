/**
 * 语义不变量校验
 *
 * 校验业务规则不变量：
 * - WEEK_START_IS_MONDAY: weekStart 必须是周一
 * - WEEKLY_PLAN_HAS_21_SLOTS: 周计划必须有 21 个餐次
 * - SYNC_RESULTS_PRESERVE_INPUT_ORDER: 同步结果保持输入顺序
 * - SERVER_VERSION_WITHIN_DB_BIGINT: serverVersion 在 DB bigint 范围内
 * - CONFIRMATION_STATE_FIELDS_MATCH: 确认状态字段匹配
 */

import type { InvariantId } from './generated/catalogs.js'
import type { ContractValidationResult } from './types.js'

// Re-export for convenience
export type { InvariantId } from './generated/catalogs.js'

// 注意: invariantMap 可从 catalogs.ts 获取，用于查询不变量元数据（appliesTo、owners）
// 但验证逻辑通过 switch 静态 dispatch，无需运行时查找

/**
 * DB bigint 上限 (2^63 - 1)
 */
const DB_BIGINT_MAX = BigInt('9223372036854775807')

/**
 * 校验不变量
 */
export function validateInvariant(
  invariantId: InvariantId,
  value: unknown,
): ContractValidationResult {
  switch (invariantId) {
    case 'WEEK_START_IS_MONDAY':
      return validateWeekStartIsMonday(value)
    case 'WEEKLY_PLAN_HAS_21_SLOTS':
      return validateWeeklyPlanHas21Slots(value)
    case 'SYNC_RESULTS_PRESERVE_INPUT_ORDER':
      return validateSyncResultsPreserveOrder(value)
    case 'SERVER_VERSION_WITHIN_DB_BIGINT':
      return validateServerVersionWithinBigint(value)
    case 'CONFIRMATION_STATE_FIELDS_MATCH':
      return validateConfirmationStateFieldsMatch(value)
    default:
      return { success: false, error: `Unknown invariant: ${invariantId}` }
  }
}

/**
 * 校验 weekStart 是周一
 */
function validateWeekStartIsMonday(value: unknown): ContractValidationResult {
  if (typeof value !== 'string') {
    return { success: false, error: 'Value must be a date string' }
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { success: false, error: 'Invalid date format' }
  }

  // getDay() returns 0 for Sunday, 1 for Monday
  if (date.getDay() !== 1) {
    return { success: false, error: `Date ${value} is not a Monday` }
  }

  return { success: true, value }
}

/**
 * 校验周计划有 21 个餐次
 */
function validateWeeklyPlanHas21Slots(value: unknown): ContractValidationResult {
  if (!value || typeof value !== 'object') {
    return { success: false, error: 'Value must be an object with items array' }
  }

  const obj = value as { items?: unknown[] }
  if (!Array.isArray(obj.items)) {
    return { success: false, error: 'Value must have items array' }
  }

  if (obj.items.length !== 21) {
    return {
      success: false,
      error: `Weekly plan must have exactly 21 slots, got ${obj.items.length}`,
    }
  }

  return { success: true, value }
}

/**
 * 校验同步结果保持输入顺序
 */
function validateSyncResultsPreserveOrder(value: unknown): ContractValidationResult {
  if (!value || typeof value !== 'object') {
    return { success: false, error: 'Value must be an object' }
  }

  const obj = value as { inputActionIds?: string[]; resultActionIds?: string[] }
  if (!Array.isArray(obj.inputActionIds) || !Array.isArray(obj.resultActionIds)) {
    return { success: false, error: 'Value must have inputActionIds and resultActionIds arrays' }
  }

  if (obj.inputActionIds.length !== obj.resultActionIds.length) {
    return { success: false, error: 'Input and result arrays must have same length' }
  }

  // 检查顺序一致
  for (let i = 0; i < obj.inputActionIds.length; i++) {
    if (obj.inputActionIds[i] !== obj.resultActionIds[i]) {
      return {
        success: false,
        error: `Order mismatch at index ${i}: input=${obj.inputActionIds[i]}, result=${obj.resultActionIds[i]}`,
      }
    }
  }

  return { success: true, value }
}

/**
 * 校验 serverVersion 在 DB bigint 范围内
 */
function validateServerVersionWithinBigint(value: unknown): ContractValidationResult {
  if (typeof value !== 'string') {
    return { success: false, error: 'ServerVersion must be a string' }
  }

  // 验证格式：正整数，无前导零
  if (!/^[1-9][0-9]*$/.test(value)) {
    return { success: false, error: 'ServerVersion must be a positive integer string' }
  }

  try {
    const bigValue = BigInt(value)
    if (bigValue > DB_BIGINT_MAX) {
      return {
        success: false,
        error: `ServerVersion ${value} exceeds DB bigint max (${DB_BIGINT_MAX})`,
      }
    }
  } catch {
    return { success: false, error: 'Invalid number format' }
  }

  return { success: true, value }
}

/**
 * 校验确认状态字段匹配
 *
 * - pending 状态必须有 confirmationToken
 * - expired/superseded/consumed 状态不能有 confirmationToken
 */
function validateConfirmationStateFieldsMatch(value: unknown): ContractValidationResult {
  if (!value || typeof value !== 'object') {
    return { success: false, error: 'Value must be an object' }
  }

  const obj = value as { state?: string; confirmationToken?: string }
  const { state, confirmationToken } = obj

  if (state === 'pending') {
    if (!confirmationToken) {
      return { success: false, error: 'Pending confirmation must have confirmationToken' }
    }
  } else if (state === 'expired' || state === 'superseded' || state === 'consumed') {
    if (confirmationToken) {
      return { success: false, error: `${state} confirmation must not have confirmationToken` }
    }
  }

  return { success: true, value }
}
