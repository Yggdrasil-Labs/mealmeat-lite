package io.yggdrasil.labs.mealmate.lite.contract

import io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedInvariantId
import io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedProtocolCatalog
import io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedSseConfirmationTokenRule
import io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedSseErrorCatalogRule
import io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedSseToolLifecycleRule
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonObject
import java.math.BigInteger

/** 一条完整的 SSE 传输帧。eventId 是断点续传与顺序校验的必需字段。 */
data class SseFrame(
    val event: String,
    val data: String,
    val eventId: String,
)

data class TraceValidationResult(
    val success: Boolean,
    val errors: List<String> = emptyList(),
)

data class ContractValidationResult<T>(
    val success: Boolean,
    val value: T? = null,
    val errors: List<String> = emptyList(),
)

/** 需要同时观察 sync 请求与响应时使用的跨消息不变量输入。 */
data class SyncResultsOrderInput(
    val inputActionIds: List<String>,
    val resultActionIds: List<String>,
)

/** 确认状态与 token 字段的最小跨字段不变量输入。 */
data class ConfirmationStateFieldsInput(
    val state: String,
    val confirmationToken: String?,
)

/** 不变量 ID 始终来自生成协议目录，不在 Android 中维护副本。 */
typealias InvariantId = GeneratedInvariantId

private enum class ToolLifecycleState {
    STARTED,
    TERMINAL,
}

private val EVENT_ID_PATTERN = Regex("^[1-9][0-9]*$")

private fun traceFailure(error: String): TraceValidationResult {
    val errors = listOf(error)
    return TraceValidationResult(
        success = false,
        errors = errors,
    )
}

private fun JsonObject.requiredString(field: String): String? =
    (this[field] as? JsonPrimitive)
        ?.takeIf { it.isString }
        ?.content
        ?.takeIf { it.isNotEmpty() }

private fun parseJsonObject(data: String): JsonObject? {
    val result =
        runCatching {
            contractJson.parseToJsonElement(data).jsonObject
        }
    return result.getOrNull()
}

/**
 * 按生成的协议目录验证 SSE trace。
 *
 * Android 只解释 `GeneratedProtocolCatalog` 的事件、转移和字段规则；事件 data 则使用
 * 同一套生成 DTO 与严格 `contractJson` 解析，避免手写 JSON 正则或平行状态机。
 */
fun validateSseTrace(frames: List<SseFrame>): TraceValidationResult = SseTraceValidator(frames).validate()

private class SseTraceValidator(
    private val frames: List<SseFrame>,
) {
    var previousEventId = BigInteger.ZERO
    var previousDefinition: io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedSseEventDefinition? = null
    var startCount = 0
    var terminalCount = 0
    var terminalSeen = false
    val dataRuleValidator = SseDataRuleValidator()

    fun validate(): TraceValidationResult {
        if (frames.isEmpty()) return traceFailure("Empty trace")

        for ((index, frame) in frames.withIndex()) {
            validateFrame(index, frame)?.let { return traceFailure(it) }
        }

        return finalError()?.let(::traceFailure) ?: TraceValidationResult(success = true)
    }

    private fun validateFrame(
        index: Int,
        frame: SseFrame,
    ): String? {
        val definition =
            GeneratedProtocolCatalog.sseEventMap[frame.event]
                ?: return "Unknown SSE event: ${frame.event}"
        val error =
            validateEventId(index, frame) ?: validateEventOrder(index, frame, definition)
                ?: validateEventData(frame, definition) ?: validateTerminal(index, frame, definition)
        if (error == null) previousDefinition = definition
        return error
    }

    private fun validateEventId(
        index: Int,
        frame: SseFrame,
    ): String? {
        if (!EVENT_ID_PATTERN.matches(frame.eventId)) return "Invalid eventId: ${frame.eventId}"
        val currentEventId = BigInteger(frame.eventId)
        return when {
            index == 0 && currentEventId != BigInteger.ONE -> {
                "First eventId must be 1, got ${frame.eventId}"
            }

            currentEventId <= previousEventId -> {
                "EventId not monotonically increasing: ${frame.eventId}"
            }

            else -> {
                previousEventId = currentEventId
                null
            }
        }
    }

    private fun validateEventOrder(
        index: Int,
        frame: SseFrame,
        definition: io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedSseEventDefinition,
    ): String? =
        when {
            index == 0 && !definition.isStart -> {
                "First event must be start, got ${frame.event}"
            }

            definition.isStart && (index != 0 || startCount != 0) -> {
                "start must occur exactly once and be the first event"
            }

            terminalSeen -> {
                "Event ${frame.event} appears after terminal event"
            }

            previousDefinition != null && frame.event !in previousDefinition!!.nextEvents -> {
                "Event ${frame.event} is not allowed after ${previousDefinition!!.event}"
            }

            else -> {
                if (definition.isStart) startCount += 1
                null
            }
        }

    private fun validateEventData(
        frame: SseFrame,
        definition: io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedSseEventDefinition,
    ): String? {
        val dataError = GeneratedProtocolCatalog.validateEventData(definition.schemaId, contractJson, frame.data)
        if (dataError != null) return "Invalid data for ${frame.event}: $dataError"
        val data =
            parseJsonObject(frame.data)
                ?: return "Invalid JSON object data for ${frame.event}"
        return dataRuleValidator.validate(definition, data)
    }

    private fun validateTerminal(
        index: Int,
        frame: SseFrame,
        definition: io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedSseEventDefinition,
    ): String? =
        when {
            !definition.isTerminal -> {
                null
            }

            index != frames.lastIndex -> {
                "Terminal event ${frame.event} must be last"
            }

            else -> {
                terminalCount += 1
                terminalSeen = true
                null
            }
        }

    private fun finalError(): String? {
        val unclosedToolIds = dataRuleValidator.unclosedToolIds()
        return when {
            startCount != 1 -> "Trace must contain exactly one start event"
            terminalCount != 1 -> "Trace must contain exactly one terminal event"
            unclosedToolIds.isNotEmpty() -> "Unclosed tool lifecycle: ${unclosedToolIds.joinToString(", ")}"
            else -> null
        }
    }
}

private class SseDataRuleValidator {
    private val toolStates = mutableMapOf<String, ToolLifecycleState>()

    fun validate(
        definition: io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedSseEventDefinition,
        data: JsonObject,
    ): String? =
        validateMutuallyExclusiveFields(definition.mutuallyExclusiveDataFields, data)
            ?: definition.toolLifecycle?.let { validateToolLifecycle(it, data) }
            ?: definition.confirmationToken?.let { validateConfirmationToken(it, data) }
            ?: definition.errorCatalog?.let { validateErrorCatalog(it, data) }

    fun unclosedToolIds(): List<String> =
        toolStates
            .filterValues { state -> state == ToolLifecycleState.STARTED }
            .keys
            .sorted()

    private fun validateMutuallyExclusiveFields(
        fields: Set<String>,
        data: JsonObject,
    ): String? =
        if (fields.size >= 2 && fields.all { field -> (data[field] as? JsonPrimitive)?.booleanOrNull == true }) {
            "${fields.joinToString(" and ")} must not all be true"
        } else {
            null
        }

    private fun validateToolLifecycle(
        rule: GeneratedSseToolLifecycleRule,
        data: JsonObject,
    ): String? {
        val toolCallId =
            data.requiredString(rule.idField)
                ?: return "tool lifecycle must contain a non-empty ${rule.idField}"
        val status =
            data.requiredString(rule.statusField)
                ?: return "tool lifecycle must contain a non-empty ${rule.statusField}"
        val current = toolStates[toolCallId]

        return when {
            status == rule.startedStatus && current != null -> {
                "Tool $toolCallId lifecycle error: ${rule.startedStatus} after $current"
            }

            status == rule.startedStatus -> {
                toolStates[toolCallId] = ToolLifecycleState.STARTED
                null
            }

            status in rule.terminalStatuses && current != ToolLifecycleState.STARTED -> {
                "Tool $toolCallId lifecycle error: $status without ${rule.startedStatus} first"
            }

            status in rule.terminalStatuses -> {
                toolStates[toolCallId] = ToolLifecycleState.TERMINAL
                null
            }

            else -> {
                "Tool $toolCallId lifecycle error: unsupported status $status"
            }
        }
    }

    private fun validateConfirmationToken(
        rule: GeneratedSseConfirmationTokenRule,
        data: JsonObject,
    ): String? {
        val state =
            data.requiredString(rule.stateField)
                ?: return "confirmation-required must contain a non-empty ${rule.stateField}"
        val hasToken = data.containsKey(rule.tokenField) && data[rule.tokenField] != null
        return when {
            state == rule.tokenRequiredState && !hasToken -> {
                "confirmation-required with state=$state must have ${rule.tokenField}"
            }

            state in rule.tokenForbiddenStates && hasToken -> {
                "confirmation-required with state=$state must not have ${rule.tokenField}"
            }

            else -> {
                null
            }
        }
    }

    /** Payload shape is generated; the shared catalog still owns code, channel and retryability. */
    private fun validateErrorCatalog(
        rule: GeneratedSseErrorCatalogRule,
        data: JsonObject,
    ): String? {
        val errCode = data.requiredString(rule.errCodeField)
        val requestId = data.requiredString(rule.requestIdField)
        val retryable = (data[rule.retryableField] as? JsonPrimitive)?.booleanOrNull
        val definition = errCode?.let(GeneratedProtocolCatalog.errorMap::get)
        return when {
            errCode == null -> {
                "SSE error must contain a non-empty ${rule.errCodeField}"
            }

            requestId == null -> {
                "SSE error must contain a non-empty ${rule.requestIdField}"
            }

            retryable == null -> {
                "SSE error must contain boolean ${rule.retryableField}"
            }

            definition == null -> {
                "Unknown error code: $errCode"
            }

            "sse" !in definition.channels -> {
                "Error $errCode not supported on sse channel"
            }

            definition.retryable != retryable -> {
                "retryable mismatch: expected ${definition.retryable} for $errCode, got $retryable"
            }

            else -> {
                null
            }
        }
    }
}
