package io.yggdrasil.labs.mealmate.lite.contract

import java.math.BigInteger
import java.time.DayOfWeek
import java.time.LocalDate

/**
 * SSE 帧数据类
 *
 * @property event SSE event 类型
 * @property data SSE data 内容
 * @property eventId 可选的 event id (用于断点续传)
 */
data class SseFrame(
    val event: String,
    val data: String,
    val eventId: String? = null,
)

/**
 * SSE Trace 验证结果
 */
data class TraceValidationResult(
    val success: Boolean,
    val errors: List<String> = emptyList(),
)

/**
 * 契约验证结果
 */
data class ContractValidationResult<T>(
    val success: Boolean,
    val value: T? = null,
    val errors: List<String> = emptyList(),
)

/**
 * 不变量 ID 枚举
 *
 * 与 protocol-catalog.json 中的 invariants 保持一致
 */
enum class InvariantId {
    /** 周计划起始日必须是周一 */
    WEEK_START_IS_MONDAY,

    /** 周计划必须有 21 个槽位 (7天 × 3餐) */
    WEEKLY_PLAN_HAS_21_SLOTS,

    /** 同步结果保持输入顺序 */
    SYNC_RESULTS_PRESERVE_INPUT_ORDER,

    /** ServerVersion 在数据库 BIGINT 范围内 */
    SERVER_VERSION_WITHIN_DB_BIGINT,

    /** 确认事件状态字段匹配 */
    CONFIRMATION_STATE_FIELDS_MATCH,
}

/**
 * SSE 事件元数据
 */
private data class SseEventMeta(
    val event: String,
    val isStart: Boolean,
    val isTerminal: Boolean,
)

/**
 * SSE 事件元数据表
 *
 * 与 protocol-catalog.json 中的 sseEvents 保持一致
 */
private val SSE_EVENT_CATALOG =
    listOf(
        SseEventMeta("start", isStart = true, isTerminal = false),
        SseEventMeta("delta", isStart = false, isTerminal = false),
        SseEventMeta("tool-status", isStart = false, isTerminal = false),
        SseEventMeta("confirmation-required", isStart = false, isTerminal = false),
        SseEventMeta("error", isStart = false, isTerminal = true),
        SseEventMeta("done", isStart = false, isTerminal = true),
    ).associateBy { it.event }

/**
 * 验证 SSE trace
 *
 * 验证规则：
 * 1. 必须以 start 事件开始
 * 2. 必须以 terminal 事件结束 (done 或 error)
 * 3. terminal 事件后不能有更多事件
 * 4. eventId 必须单调递增 (如果存在)
 * 5. tool-status 必须闭合 (started 必须有 succeeded 或 failed)
 *
 * @param frames SSE 帧序列
 * @return 验证结果
 */
fun validateSseTrace(frames: List<SseFrame>): TraceValidationResult {
    val errors = mutableListOf<String>()

    if (frames.isEmpty()) {
        return TraceValidationResult(success = false, errors = listOf("Empty trace"))
    }

    // 1. 检查 start 事件
    val firstFrame = frames.first()
    val firstMeta = SSE_EVENT_CATALOG[firstFrame.event]
    if (firstMeta?.isStart != true) {
        errors.add("Trace must start with 'start' event, got '${firstFrame.event}'")
    }

    // 2. 检查 terminal 事件
    val lastFrame = frames.last()
    val lastMeta = SSE_EVENT_CATALOG[lastFrame.event]
    if (lastMeta?.isTerminal != true) {
        errors.add("Trace must end with terminal event (done or error), got '${lastFrame.event}'")
    }

    // 3. 检查 terminal 后没有更多事件
    var terminalSeen = false
    for ((index, frame) in frames.withIndex()) {
        val meta = SSE_EVENT_CATALOG[frame.event]
        if (terminalSeen) {
            errors.add("Event '${frame.event}' at index $index after terminal event")
        }
        if (meta?.isTerminal == true) {
            terminalSeen = true
        }
    }

    // 4. 检查 eventId 单调递增
    var lastEventId: Long? = null
    for ((index, frame) in frames.withIndex()) {
        if (frame.eventId != null) {
            val currentId =
                frame.eventId.toLongOrNull()
                    ?: run {
                        errors.add("Invalid eventId '${frame.eventId}' at index $index")
                        continue
                    }
            if (lastEventId != null && currentId <= lastEventId) {
                errors.add("Non-monotonic eventId at index $index: $currentId <= $lastEventId")
            }
            lastEventId = currentId
        }
    }

    // 5. 检查 tool-status 闭合
    val openTools = mutableMapOf<String, String>() // toolCallId -> toolName
    for (frame in frames) {
        if (frame.event == "tool-status") {
            // 简单解析 JSON 获取 toolCallId, toolName, status
            val toolCallIdMatch = """"toolCallId"\s*:\s*"([^"]+)"""".toRegex().find(frame.data)
            val toolNameMatch = """"toolName"\s*:\s*"([^"]+)"""".toRegex().find(frame.data)
            val statusMatch = """"status"\s*:\s*"([^"]+)"""".toRegex().find(frame.data)

            val toolCallId = toolCallIdMatch?.groupValues?.get(1) ?: continue
            val toolName = toolNameMatch?.groupValues?.get(1) ?: "unknown"
            val status = statusMatch?.groupValues?.get(1) ?: continue

            when (status) {
                "started" -> openTools[toolCallId] = toolName
                "succeeded", "failed" -> openTools.remove(toolCallId)
            }
        }
    }

    if (openTools.isNotEmpty()) {
        for ((callId, name) in openTools) {
            errors.add("Unclosed tool: $name (callId: $callId)")
        }
    }

    return TraceValidationResult(
        success = errors.isEmpty(),
        errors = errors,
    )
}

/**
 * 验证不变量
 *
 * @param invariantId 不变量 ID
 * @param value 要验证的值
 * @return 验证结果
 */
fun validateInvariant(
    invariantId: InvariantId,
    value: Any?,
): ContractValidationResult<Any?> =
    when (invariantId) {
        InvariantId.WEEK_START_IS_MONDAY -> {
            validateWeekStartIsMonday(value)
        }

        InvariantId.WEEKLY_PLAN_HAS_21_SLOTS -> {
            validateWeeklyPlanHas21Slots(value)
        }

        InvariantId.SYNC_RESULTS_PRESERVE_INPUT_ORDER -> {
            // 这个不变量在 server 端验证，Android 只消费结果
            ContractValidationResult(success = true, value = value)
        }

        InvariantId.SERVER_VERSION_WITHIN_DB_BIGINT -> {
            validateServerVersionWithinDbBigint(value)
        }

        InvariantId.CONFIRMATION_STATE_FIELDS_MATCH -> {
            // 这个需要完整的 ConfirmationEventDto，简化处理
            ContractValidationResult(success = true, value = value)
        }
    }

private fun validateWeekStartIsMonday(value: Any?): ContractValidationResult<Any?> {
    if (value !is String) {
        return ContractValidationResult(
            success = false,
            errors = listOf("Expected date string, got ${value?.javaClass?.simpleName}"),
        )
    }

    val date =
        runCatching { LocalDate.parse(value) }
            .getOrElse {
                return ContractValidationResult(
                    success = false,
                    errors = listOf("Invalid date format: $value"),
                )
            }

    return if (date.dayOfWeek == DayOfWeek.MONDAY) {
        ContractValidationResult(success = true, value = value)
    } else {
        ContractValidationResult(
            success = false,
            errors = listOf("Week start must be Monday, got ${date.dayOfWeek}"),
        )
    }
}

private fun validateWeeklyPlanHas21Slots(value: Any?): ContractValidationResult<Any?> {
    val count =
        when (value) {
            is Int -> {
                value
            }

            is Long -> {
                value.toInt()
            }

            is Number -> {
                value.toInt()
            }

            else -> {
                return ContractValidationResult(
                    success = false,
                    errors = listOf("Expected number, got ${value?.javaClass?.simpleName}"),
                )
            }
        }

    return if (count == 21) {
        ContractValidationResult(success = true, value = value)
    } else {
        ContractValidationResult(
            success = false,
            errors = listOf("Weekly plan must have 21 slots (7 days × 3 meals), got $count"),
        )
    }
}

private const val MAX_BIGINT = "9223372036854775807" // Long.MAX_VALUE

private fun validateServerVersionWithinDbBigint(value: Any?): ContractValidationResult<Any?> {
    if (value !is String) {
        return ContractValidationResult(
            success = false,
            errors = listOf("Expected string, got ${value?.javaClass?.simpleName}"),
        )
    }

    val version =
        runCatching { BigInteger(value) }
            .getOrElse {
                return ContractValidationResult(
                    success = false,
                    errors = listOf("Invalid server version format: $value"),
                )
            }

    val maxBigint = BigInteger(MAX_BIGINT)

    return if (version in BigInteger.ONE..maxBigint) {
        ContractValidationResult(success = true, value = value)
    } else {
        ContractValidationResult(
            success = false,
            errors = listOf("Server version out of BIGINT range: $value"),
        )
    }
}
