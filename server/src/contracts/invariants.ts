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
import { invariantMap, sseEvents } from './generated/catalogs.js'
import type { ContractValidationResult } from './types.js'

// Re-export for convenience
export type { InvariantId } from './generated/catalogs.js'

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
  // 准入集合来自生成目录；手写实现只能解释已登记的 invariant，不能扩展权威源。
  if (!invariantMap.has(invariantId)) {
    return { success: false, error: `Unknown invariant: ${invariantId}` }
  }

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

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return { success: false, error: 'Invalid date format' }
  }
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { success: false, error: 'Invalid date format' }
  }

  // 仅使用 UTC，避免部署主机时区改变 date-only 的星期判定。
  if (date.getUTCDay() !== 1) {
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

  const rule = sseEvents.map((event) => event.confirmationToken).find(Boolean)
  if (!rule) {
    return { success: false, error: 'Generated protocol catalog has no confirmation token rule' }
  }
  const obj = value as Record<string, unknown>
  const state = obj[rule.stateField]
  if (typeof state !== 'string' || state.length === 0) {
    return { success: false, error: `Value must have non-empty ${rule.stateField}` }
  }
  const hasToken = Object.hasOwn(obj, rule.tokenField) && obj[rule.tokenField] !== null

  if (
    state === rule.tokenRequiredState &&
    (typeof obj[rule.tokenField] !== 'string' || !obj[rule.tokenField])
  ) {
    return { success: false, error: `${rule.tokenField} is required for state ${state}` }
  }
  if (rule.tokenForbiddenStates.includes(state) && hasToken) {
    return { success: false, error: `${rule.tokenField} is forbidden for state ${state}` }
  }
  if (state !== rule.tokenRequiredState && !rule.tokenForbiddenStates.includes(state)) {
    return { success: false, error: `Unknown confirmation state: ${state}` }
  }

  return { success: true, value }
}
