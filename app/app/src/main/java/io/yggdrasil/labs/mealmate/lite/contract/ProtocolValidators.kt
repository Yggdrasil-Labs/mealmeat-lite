package io.yggdrasil.labs.mealmate.lite.contract

import io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedInvariantId
import io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedProtocolCatalog
import io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedSseConfirmationTokenRule
import io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedSseErrorCatalogRule
import io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedSseToolLifecycleRule
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonObject
import java.math.BigInteger
import java.time.DayOfWeek
import java.time.LocalDate

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
private const val MAX_BIGINT = "9223372036854775807"
private val POSITIVE_INTEGER_PATTERN = Regex("^[1-9][0-9]*$")

private fun traceFailure(error: String): TraceValidationResult = TraceValidationResult(success = false, errors = listOf(error))

private fun JsonObject.requiredString(field: String): String? =
    (this[field] as? JsonPrimitive)
        ?.takeIf { it.isString }
        ?.content
        ?.takeIf { it.isNotEmpty() }

private fun JsonElement.stringValue(): String? =
    (this as? JsonPrimitive)
        ?.takeIf { it.isString }
        ?.content

private fun stringValue(value: Any?): String? =
    when (value) {
        is String -> value
        is JsonElement -> value.stringValue()
        else -> null
    }

private fun parseJsonObject(data: String): JsonObject? = runCatching { contractJson.parseToJsonElement(data).jsonObject }.getOrNull()

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
    states: MutableMap<String, ToolLifecycleState>,
): String? {
    val toolCallId =
        data.requiredString(rule.idField)
            ?: return "tool lifecycle must contain a non-empty ${rule.idField}"
    val status =
        data.requiredString(rule.statusField)
            ?: return "tool lifecycle must contain a non-empty ${rule.statusField}"
    val current = states[toolCallId]

    return when {
        status == rule.startedStatus -> {
            if (current != null) {
                "Tool $toolCallId lifecycle error: ${rule.startedStatus} after $current"
            } else {
                states[toolCallId] = ToolLifecycleState.STARTED
                null
            }
        }

        status in rule.terminalStatuses -> {
            if (current != ToolLifecycleState.STARTED) {
                "Tool $toolCallId lifecycle error: $status without ${rule.startedStatus} first"
            } else {
                states[toolCallId] = ToolLifecycleState.TERMINAL
                null
            }
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

/**
 * SseErrorEvent 的 DTO 只验证 payload shape；code、通道和 retryable 仍由
 * 编译出的公共错误目录裁决，避免 Android 维护另一份错误表。
 */
private fun validateErrorCatalog(
    rule: GeneratedSseErrorCatalogRule,
    data: JsonObject,
): String? {
    val errCode = data.requiredString(rule.errCodeField) ?: return "SSE error must contain a non-empty ${rule.errCodeField}"
    if (data.requiredString(rule.requestIdField) == null) {
        return "SSE error must contain a non-empty ${rule.requestIdField}"
    }
    val retryable =
        (data[rule.retryableField] as? JsonPrimitive)
            ?.booleanOrNull
            ?: return "SSE error must contain boolean ${rule.retryableField}"
    val definition =
        GeneratedProtocolCatalog.errorMap[errCode]
            ?: return "Unknown error code: $errCode"
    if ("sse" !in definition.channels) return "Error $errCode not supported on sse channel"
    if (definition.retryable != retryable) {
        return "retryable mismatch: expected ${definition.retryable} for $errCode, got $retryable"
    }
    return null
}

/**
 * 按生成的协议目录验证 SSE trace。
 *
 * Android 只解释 `GeneratedProtocolCatalog` 的事件、转移和字段规则；事件 data 则使用
 * 同一套生成 DTO 与严格 `contractJson` 解析，避免手写 JSON 正则或平行状态机。
 */
fun validateSseTrace(frames: List<SseFrame>): TraceValidationResult {
    if (frames.isEmpty()) return traceFailure("Empty trace")

    var previousEventId = BigInteger.ZERO
    var previousDefinition: io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedSseEventDefinition? = null
    var startCount = 0
    var terminalCount = 0
    var terminalSeen = false
    val toolStates = mutableMapOf<String, ToolLifecycleState>()

    for ((index, frame) in frames.withIndex()) {
        val definition =
            GeneratedProtocolCatalog.sseEventMap[frame.event]
                ?: return traceFailure("Unknown SSE event: ${frame.event}")

        if (!EVENT_ID_PATTERN.matches(frame.eventId)) {
            return traceFailure("Invalid eventId: ${frame.eventId}")
        }
        val currentEventId = BigInteger(frame.eventId)
        if (index == 0 && currentEventId != BigInteger.ONE) {
            return traceFailure("First eventId must be 1, got ${frame.eventId}")
        }
        if (currentEventId <= previousEventId) {
            return traceFailure("EventId not monotonically increasing: ${frame.eventId}")
        }
        previousEventId = currentEventId

        if (index == 0 && !definition.isStart) {
            return traceFailure("First event must be start, got ${frame.event}")
        }
        if (definition.isStart) {
            startCount += 1
            if (index != 0 || startCount != 1) {
                return traceFailure("start must occur exactly once and be the first event")
            }
        }
        if (terminalSeen) {
            return traceFailure("Event ${frame.event} appears after terminal event")
        }
        if (previousDefinition != null && frame.event !in previousDefinition.nextEvents) {
            return traceFailure("Event ${frame.event} is not allowed after ${previousDefinition.event}")
        }

        val dataError = GeneratedProtocolCatalog.validateEventData(definition.schemaId, contractJson, frame.data)
        if (dataError != null) {
            return traceFailure("Invalid data for ${frame.event}: $dataError")
        }
        val data =
            parseJsonObject(frame.data)
                ?: return traceFailure("Invalid JSON object data for ${frame.event}")

        validateMutuallyExclusiveFields(definition.mutuallyExclusiveDataFields, data)?.let {
            return traceFailure(it)
        }
        definition.toolLifecycle?.let { rule ->
            validateToolLifecycle(rule, data, toolStates)?.let { return traceFailure(it) }
        }
        definition.confirmationToken?.let { rule ->
            validateConfirmationToken(rule, data)?.let { return traceFailure(it) }
        }
        definition.errorCatalog?.let { rule ->
            validateErrorCatalog(rule, data)?.let { return traceFailure(it) }
        }

        if (definition.isTerminal) {
            terminalCount += 1
            terminalSeen = true
            if (index != frames.lastIndex) {
                return traceFailure("Terminal event ${frame.event} must be last")
            }
        }
        previousDefinition = definition
    }

    if (startCount != 1) return traceFailure("Trace must contain exactly one start event")
    if (terminalCount != 1) return traceFailure("Trace must contain exactly one terminal event")
    val unclosedToolIds =
        toolStates
            .filterValues { state -> state == ToolLifecycleState.STARTED }
            .keys
            .sorted()
    if (unclosedToolIds.isNotEmpty()) {
        return traceFailure("Unclosed tool lifecycle: ${unclosedToolIds.joinToString(", ")}")
    }
    return TraceValidationResult(success = true)
}

fun validateInvariant(
    invariantId: InvariantId,
    value: Any?,
): ContractValidationResult<Any?> {
    if (invariantId !in GeneratedProtocolCatalog.invariantMap) {
        return validationFailure("Unknown invariant: $invariantId")
    }
    return when (invariantId) {
        InvariantId.WEEK_START_IS_MONDAY -> validateWeekStartIsMonday(value)
        InvariantId.WEEKLY_PLAN_HAS_21_SLOTS -> validateWeeklyPlanHas21Slots(value)
        InvariantId.SYNC_RESULTS_PRESERVE_INPUT_ORDER -> validateSyncResultsPreserveInputOrder(value)
        InvariantId.SERVER_VERSION_WITHIN_DB_BIGINT -> validateServerVersionWithinDbBigint(value)
        InvariantId.CONFIRMATION_STATE_FIELDS_MATCH -> validateConfirmationStateFieldsMatch(value)
    }
}

private fun validationFailure(error: String): ContractValidationResult<Any?> =
    ContractValidationResult(success = false, errors = listOf(error))

private fun validateWeekStartIsMonday(value: Any?): ContractValidationResult<Any?> {
    val raw = stringValue(value) ?: return validationFailure("Expected date string, got ${value?.javaClass?.simpleName}")

    val date =
        runCatching { LocalDate.parse(raw) }
            .getOrElse { return validationFailure("Invalid date format: $raw") }
    return if (date.dayOfWeek == DayOfWeek.MONDAY) {
        ContractValidationResult(success = true, value = value)
    } else {
        validationFailure("Week start must be Monday, got ${date.dayOfWeek}")
    }
}

private fun validateWeeklyPlanHas21Slots(value: Any?): ContractValidationResult<Any?> {
    val count =
        when (value) {
            is JsonObject -> (value["items"] as? JsonArray)?.size
            is Map<*, *> -> (value["items"] as? Collection<*>)?.size
            else -> null
        }
            ?: return validationFailure("Expected object with items array")
    return if (count == 21) {
        ContractValidationResult(success = true, value = value)
    } else {
        validationFailure("Weekly plan must have 21 slots (7 days × 3 meals), got $count")
    }
}

private fun validateSyncResultsPreserveInputOrder(value: Any?): ContractValidationResult<Any?> {
    val (inputActionIds, resultActionIds) =
        when (value) {
            is SyncResultsOrderInput -> {
                value.inputActionIds to value.resultActionIds
            }

            is JsonObject -> {
                val input = value.stringArray("inputActionIds")
                val result = value.stringArray("resultActionIds")
                if (input == null || result == null) {
                    return validationFailure("Expected inputActionIds and resultActionIds arrays")
                }
                input to result
            }

            is Map<*, *> -> {
                val input = value.stringList("inputActionIds")
                val result = value.stringList("resultActionIds")
                if (input == null || result == null) {
                    return validationFailure("Expected inputActionIds and resultActionIds arrays")
                }
                input to result
            }

            else -> {
                return validationFailure("Expected sync order object")
            }
        }
    return if (inputActionIds == resultActionIds) {
        ContractValidationResult(success = true, value = value)
    } else {
        validationFailure("Sync result actionIds must preserve input order")
    }
}

private fun validateServerVersionWithinDbBigint(value: Any?): ContractValidationResult<Any?> {
    val raw = stringValue(value) ?: return validationFailure("Expected string, got ${value?.javaClass?.simpleName}")
    if (!POSITIVE_INTEGER_PATTERN.matches(raw)) {
        return validationFailure("Invalid server version format: $raw")
    }

    val version =
        runCatching { BigInteger(raw) }
            .getOrElse { return validationFailure("Invalid server version format: $raw") }
    val maxBigint = BigInteger(MAX_BIGINT)
    return if (version in BigInteger.ONE..maxBigint) {
        ContractValidationResult(success = true, value = value)
    } else {
        validationFailure("Server version out of BIGINT range: $raw")
    }
}

private fun validateConfirmationStateFieldsMatch(value: Any?): ContractValidationResult<Any?> {
    val rule =
        GeneratedProtocolCatalog.sseEvents.mapNotNull { it.confirmationToken }.singleOrNull()
            ?: return validationFailure("Generated protocol catalog has no unique confirmation token rule")
    val fields =
        when (value) {
            is ConfirmationStateFieldsInput -> {
                ConfirmationInvariantFields(
                    state = value.state,
                    hasToken = value.confirmationToken != null,
                    token = value.confirmationToken,
                )
            }

            is JsonObject -> {
                ConfirmationInvariantFields(
                    state = value.requiredString(rule.stateField),
                    hasToken = value.containsKey(rule.tokenField) && value[rule.tokenField] != null,
                    token = value[rule.tokenField]?.stringValue(),
                )
            }

            is Map<*, *> -> {
                ConfirmationInvariantFields(
                    state = value[rule.stateField] as? String,
                    hasToken = value.containsKey(rule.tokenField) && value[rule.tokenField] != null,
                    token = value[rule.tokenField] as? String,
                )
            }

            else -> {
                return validationFailure("Expected confirmation state object")
            }
        }
    val state = fields.state ?: return validationFailure("${rule.stateField} is required")

    return when {
        state == rule.tokenRequiredState && fields.token.isNullOrEmpty() -> {
            validationFailure("${rule.tokenField} is required for state $state")
        }

        state in rule.tokenForbiddenStates && fields.hasToken -> {
            validationFailure("${rule.tokenField} is forbidden for state $state")
        }

        state != rule.tokenRequiredState && state !in rule.tokenForbiddenStates -> {
            validationFailure("Unknown confirmation state: $state")
        }

        else -> {
            ContractValidationResult(success = true, value = value)
        }
    }
}

private data class ConfirmationInvariantFields(
    val state: String?,
    val hasToken: Boolean,
    val token: String?,
)

private fun JsonObject.stringArray(field: String): List<String>? = (this[field] as? JsonArray)?.stringValues()

private fun JsonArray.stringValues(): List<String>? {
    val values = mutableListOf<String>()
    for (element in this) {
        val value = element.stringValue() ?: return null
        values += value
    }
    return values
}

private fun Map<*, *>.stringList(field: String): List<String>? {
    val values = this[field] as? List<*> ?: return null
    if (values.any { it !is String }) return null
    @Suppress("UNCHECKED_CAST")
    return values as List<String>
}
