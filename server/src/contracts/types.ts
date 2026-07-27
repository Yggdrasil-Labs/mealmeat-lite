/**
 * 契约类型定义
 *
 * 定义 v1 契约的 manifest、schema、operation、工具和协议结构
 */

// ============================================================================
// Contract Manifest
// ============================================================================

/**
 * 契约 manifest — 描述 v1 契约的完整覆盖
 */
export interface ContractManifest {
  /** 契约版本 */
  contractVersion: 'v1'
  /** 源文件集合的 SHA-256 fingerprint */
  fingerprint: string
  /** HTTP operations */
  httpOperations: readonly OperationDescriptor[]
  /** Function Calling 工具 */
  functionTools: readonly FunctionToolDescriptor[]
  /** SSE 事件 */
  sseEvents: readonly SseEventDescriptor[]
  /** 所有 schema */
  schemas: readonly SchemaDescriptor[]
  /** 公共错误定义 */
  errors: readonly PublicErrorDefinition[]
  /** 语义不变量 */
  invariants: readonly InvariantDefinition[]
}

// ============================================================================
// Schema Descriptors
// ============================================================================

export interface SchemaDescriptor {
  /** 唯一 schema ID，如 "RecipeView" */
  id: string
  /** 源文件相对路径 */
  file: string
  /** JSON Schema dialect */
  dialect: '2020-12'
  /** 是否为公开 schema */
  public: boolean
}

// ============================================================================
// HTTP Operation Descriptors
// ============================================================================

export interface OperationDescriptor {
  /** 唯一 operation ID */
  operationId: string
  /** HTTP 方法 */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** 路径模板 */
  path: string
  /** 请求 schema ID（可选） */
  requestSchemaId?: string
  /** 响应 schema/status 映射 */
  responses: Record<number, string | null>
}

// ============================================================================
// Function Calling Tool Descriptors
// ============================================================================

export type FunctionToolName =
  | 'add_recipe'
  | 'update_recipe'
  | 'delete_recipe'
  | 'restore_recipe'
  | 'search_recipes'
  | 'batch_generate_recipes'
  | 'generate_weekly_plan'
  | 'update_plan_item'

export interface FunctionToolDescriptor {
  /** 工具名称 */
  name: FunctionToolName
  /** 工具描述 */
  description: string
  /** 输入 schema ID */
  inputSchemaId: string
  /** 输出 schema ID */
  outputSchemaId: string
}

// ============================================================================
// SSE Event Descriptors
// ============================================================================

export type SseEventName =
  | 'start'
  | 'delta'
  | 'tool-status'
  | 'confirmation-required'
  | 'error'
  | 'done'

export interface SseEventDescriptor {
  /** 事件名称 */
  event: SseEventName
  /** data schema ID */
  schemaId: string
  /** 是否为起始事件 */
  isStart: boolean
  /** 是否为终止事件 */
  isTerminal: boolean
}

// ============================================================================
// Public Error Definitions
// ============================================================================

export type PublicErrorCode =
  | 'BAD_REQUEST'
  | 'INVALID_CURSOR'
  | 'UNAUTHORIZED'
  | 'INVALID_BOOTSTRAP_SECRET'
  | 'INVALID_FAMILY_CODE'
  | 'RECIPE_NOT_FOUND'
  | 'PLAN_NOT_FOUND'
  | 'DEVICE_NOT_FOUND'
  | 'CONFIRMATION_NOT_FOUND'
  | 'CHAT_REQUEST_EXPIRED'
  | 'CONFIRMATION_EXPIRED'
  | 'ALREADY_INITIALIZED'
  | 'NOT_INITIALIZED'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'RECIPE_DELETED'
  | 'CHAT_REQUEST_SUPERSEDED'
  | 'CONFIRMATION_CONSUMED'
  | 'CONFIRMATION_SUPERSEDED'
  | 'CONFIRMATION_STALE'
  | 'RECIPE_IN_USE'
  | 'CHAT_IN_PROGRESS'
  | 'CHAT_DEVICE_BUSY'
  | 'VALIDATION_ERROR'
  | 'INVALID_WEEK_START'
  | 'MODEL_UNAVAILABLE'
  | 'NO_NEW_RECIPES'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SYNC_CHANGE_TOO_LARGE'
  | 'PROVIDER_ERROR'
  | 'NOT_READY'
  | 'SERVICE_BUSY'
  | 'MODEL_TIMEOUT'

export type RetryAfterPolicy =
  | { kind: 'none' }
  | { kind: 'fixed'; seconds: 1 | 5 }
  | { kind: 'range'; minSeconds: number; maxSeconds: number }

export interface PublicErrorDefinition {
  /** 错误码 */
  errCode: PublicErrorCode
  /** HTTP 状态码 */
  httpStatus: 400 | 401 | 404 | 409 | 410 | 422 | 429 | 500 | 502 | 503 | 504
  /** 是否可重试 */
  retryable: boolean
  /** Retry-After 策略 */
  retryAfter: RetryAfterPolicy
  /** 允许的传输通道 */
  channels: readonly ('json' | 'sse')[]
}

// ============================================================================
// Invariant Definitions
// ============================================================================

export type InvariantId =
  | 'WEEK_START_IS_MONDAY'
  | 'WEEKLY_PLAN_HAS_21_SLOTS'
  | 'SYNC_RESULTS_PRESERVE_INPUT_ORDER'
  | 'SERVER_VERSION_WITHIN_DB_BIGINT'
  | 'CONFIRMATION_STATE_FIELDS_MATCH'

export type InvariantOwner = 'server' | 'android' | 'database'

export interface InvariantDefinition {
  /** 不变量 ID */
  id: InvariantId
  /** 适用的 schema ID */
  appliesTo: string[]
  /** 执行责任方 */
  owners: readonly InvariantOwner[]
}

// ============================================================================
// Generated Diff (for check command)
// ============================================================================

export interface GeneratedDiff {
  /** 是否有变化 */
  hasChanges: boolean
  /** 新增文件 */
  added: string[]
  /** 修改文件 */
  modified: string[]
  /** 陈旧文件（应删除） */
  deleted: string[]
}

// ============================================================================
// Contract Validation Result (Discriminated Union)
// ============================================================================

/**
 * 契约校验结果 — 使用 discriminated union 支持类型收窄
 *
 * 用法：
 * ```typescript
 * const result = validateContract('RecipeView', data)
 * if (result.success) {
 *   // TypeScript 自动收窄 result.value 为 T
 *   console.log(result.value)
 * } else {
 *   // TypeScript 自动收窄 result.error 为 string
 *   console.error(result.error, result.errors)
 * }
 * ```
 */
export type ContractValidationResult<T = unknown> =
  | { success: true; value: T }
  | { success: false; error: string; errors?: ReadonlyArray<{ path: string; message: string }> }

/**
 * SSE Trace 校验结果 — 使用 discriminated union 支持类型收窄
 */
export type TraceValidationResult = { success: true } | { success: false; error: string }

// ============================================================================
// Contract Errors
// ============================================================================

export type ContractErrorCode =
  | 'CONTRACT_DUPLICATE_ID'
  | 'CONTRACT_UNRESOLVED_REF'
  | 'CONTRACT_PROFILE_VIOLATION'
  | 'CONTRACT_COVERAGE_MISMATCH'
  | 'CONTRACT_GENERATED_DRIFT'
  | 'CONTRACT_PROVIDER_PROJECTION_UNSAFE'
  | 'CONTRACT_UNSAFE_PATH'

export class ContractError extends Error {
  constructor(
    public readonly code: ContractErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ContractError'
  }
}
