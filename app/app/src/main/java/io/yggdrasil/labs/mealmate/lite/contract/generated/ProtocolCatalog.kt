@file:Suppress("unused")

package io.yggdrasil.labs.mealmate.lite.contract.generated

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ConfirmationEventDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SseDeltaEvent
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SseDoneEvent
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SseErrorEvent
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SseStartEvent
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SseToolStatusEvent

/**
 * 协议目录 - 由契约编译器生成，禁止手改。
 * @generated
 */
data class GeneratedSseToolLifecycleRule(
    val idField: String,
    val statusField: String,
    val startedStatus: String,
    val terminalStatuses: Set<String>,
)

data class GeneratedSseConfirmationTokenRule(
    val stateField: String,
    val tokenField: String,
    val tokenRequiredState: String,
    val tokenForbiddenStates: Set<String>,
)

data class GeneratedSseErrorCatalogRule(
    val errCodeField: String,
    val retryableField: String,
    val requestIdField: String,
)

data class GeneratedPublicErrorDefinition(
    val errCode: String,
    val httpStatus: Int,
    val retryable: Boolean,
    val retryAfter: GeneratedRetryAfterPolicy,
    val channels: Set<String>,
)

data class GeneratedRetryAfterPolicy(
    val kind: String,
    val seconds: Int? = null,
    val minSeconds: Int? = null,
    val maxSeconds: Int? = null,
)

data class GeneratedInvariantDefinition(
    val id: GeneratedInvariantId,
    val appliesTo: Set<String>,
    val owners: Set<String>,
    /** Canonical JSON inputs, shared by Server and Android regression tests. */
    val validVectors: List<String>,
    val invalidVectors: List<String>,
)

data class GeneratedSseEventDefinition(
    val event: String,
    val schemaId: String,
    val isStart: Boolean,
    val isTerminal: Boolean,
    val nextEvents: Set<String>,
    val toolLifecycle: GeneratedSseToolLifecycleRule? = null,
    val confirmationToken: GeneratedSseConfirmationTokenRule? = null,
    val errorCatalog: GeneratedSseErrorCatalogRule? = null,
    val mutuallyExclusiveDataFields: Set<String> = emptySet(),
)

enum class GeneratedInvariantId {
    WEEK_START_IS_MONDAY,
    WEEKLY_PLAN_HAS_21_SLOTS,
    SYNC_RESULTS_PRESERVE_INPUT_ORDER,
    SERVER_VERSION_WITHIN_DB_BIGINT,
    CONFIRMATION_STATE_FIELDS_MATCH,
}

object GeneratedProtocolCatalog {
    val sseEvents: List<GeneratedSseEventDefinition> =
        listOf(
            GeneratedSseEventDefinition(
                event = "start",
                schemaId = "SseStartEvent",
                isStart = true,
                isTerminal = false,
                nextEvents = setOf("delta", "tool-status", "confirmation-required", "error", "done"),
                mutuallyExclusiveDataFields = setOf("replayed", "resumed"),
            ),
            GeneratedSseEventDefinition(
                event = "delta",
                schemaId = "SseDeltaEvent",
                isStart = false,
                isTerminal = false,
                nextEvents = setOf("delta", "tool-status", "confirmation-required", "error", "done"),
                mutuallyExclusiveDataFields = emptySet(),
            ),
            GeneratedSseEventDefinition(
                event = "tool-status",
                schemaId = "SseToolStatusEvent",
                isStart = false,
                isTerminal = false,
                nextEvents = setOf("delta", "tool-status", "confirmation-required", "error", "done"),
                toolLifecycle = GeneratedSseToolLifecycleRule(
                    idField = "toolCallId",
                    statusField = "status",
                    startedStatus = "started",
                    terminalStatuses = setOf("succeeded", "failed"),
                ),
                mutuallyExclusiveDataFields = emptySet(),
            ),
            GeneratedSseEventDefinition(
                event = "confirmation-required",
                schemaId = "SseConfirmationRequiredEvent",
                isStart = false,
                isTerminal = false,
                nextEvents = setOf("delta", "tool-status", "confirmation-required", "error", "done"),
                confirmationToken = GeneratedSseConfirmationTokenRule(
                    stateField = "state",
                    tokenField = "confirmationToken",
                    tokenRequiredState = "pending",
                    tokenForbiddenStates = setOf("expired", "superseded", "consumed"),
                ),
                mutuallyExclusiveDataFields = emptySet(),
            ),
            GeneratedSseEventDefinition(
                event = "error",
                schemaId = "SseErrorEvent",
                isStart = false,
                isTerminal = true,
                nextEvents = emptySet(),
                errorCatalog = GeneratedSseErrorCatalogRule(
                    errCodeField = "errCode",
                    retryableField = "retryable",
                    requestIdField = "requestId",
                ),
                mutuallyExclusiveDataFields = emptySet(),
            ),
            GeneratedSseEventDefinition(
                event = "done",
                schemaId = "SseDoneEvent",
                isStart = false,
                isTerminal = true,
                nextEvents = emptySet(),
                mutuallyExclusiveDataFields = emptySet(),
            ),
        )

    val sseEventMap: Map<String, GeneratedSseEventDefinition> =
        sseEvents.associateBy { it.event }

    val errors: List<GeneratedPublicErrorDefinition> =
        listOf(
            GeneratedPublicErrorDefinition(
                errCode = "BAD_REQUEST",
                httpStatus = 400,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json", "sse"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "INVALID_CURSOR",
                httpStatus = 400,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "UNAUTHORIZED",
                httpStatus = 401,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "INVALID_BOOTSTRAP_SECRET",
                httpStatus = 401,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "INVALID_FAMILY_CODE",
                httpStatus = 401,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "RECIPE_NOT_FOUND",
                httpStatus = 404,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json", "sse"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "PLAN_NOT_FOUND",
                httpStatus = 404,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "DEVICE_NOT_FOUND",
                httpStatus = 404,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "CONFIRMATION_NOT_FOUND",
                httpStatus = 404,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "CHAT_REQUEST_EXPIRED",
                httpStatus = 410,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "CONFIRMATION_EXPIRED",
                httpStatus = 410,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "ALREADY_INITIALIZED",
                httpStatus = 409,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "NOT_INITIALIZED",
                httpStatus = 409,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "IDEMPOTENCY_KEY_REUSED",
                httpStatus = 409,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "RECIPE_DELETED",
                httpStatus = 409,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json", "sse"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "CHAT_REQUEST_SUPERSEDED",
                httpStatus = 409,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "CONFIRMATION_CONSUMED",
                httpStatus = 409,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "CONFIRMATION_SUPERSEDED",
                httpStatus = 409,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json", "sse"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "CONFIRMATION_STALE",
                httpStatus = 409,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "RECIPE_IN_USE",
                httpStatus = 409,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json", "sse"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "CHAT_IN_PROGRESS",
                httpStatus = 409,
                retryable = true,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "range",
                    minSeconds = 1,
                    maxSeconds = 30,
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "CHAT_DEVICE_BUSY",
                httpStatus = 409,
                retryable = true,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "range",
                    minSeconds = 1,
                    maxSeconds = 30,
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "VALIDATION_ERROR",
                httpStatus = 422,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json", "sse"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "INVALID_WEEK_START",
                httpStatus = 422,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json", "sse"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "MODEL_UNAVAILABLE",
                httpStatus = 422,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "NO_NEW_RECIPES",
                httpStatus = 422,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("sse"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "RATE_LIMITED",
                httpStatus = 429,
                retryable = true,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "range",
                    minSeconds = 1,
                    maxSeconds = 900,
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "INTERNAL_ERROR",
                httpStatus = 500,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json", "sse"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "SYNC_CHANGE_TOO_LARGE",
                httpStatus = 500,
                retryable = false,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "PROVIDER_ERROR",
                httpStatus = 502,
                retryable = true,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "fixed",
                    seconds = 5,
                ),
                channels = setOf("json", "sse"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "NOT_READY",
                httpStatus = 503,
                retryable = true,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "fixed",
                    seconds = 5,
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "SERVICE_BUSY",
                httpStatus = 503,
                retryable = true,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "fixed",
                    seconds = 1,
                ),
                channels = setOf("json"),
            ),
            GeneratedPublicErrorDefinition(
                errCode = "MODEL_TIMEOUT",
                httpStatus = 504,
                retryable = true,
                retryAfter = GeneratedRetryAfterPolicy(
                    kind = "none",
                ),
                channels = setOf("json", "sse"),
            ),
        )

    val errorMap: Map<String, GeneratedPublicErrorDefinition> =
        errors.associateBy { it.errCode }

    val invariantDefinitions: List<GeneratedInvariantDefinition> =
        listOf(
            GeneratedInvariantDefinition(
                id = GeneratedInvariantId.WEEK_START_IS_MONDAY,
                appliesTo = setOf("WeeklyPlanView", "GenerateWeeklyPlanInput"),
                owners = setOf("server", "android", "database"),
                validVectors = listOf("\"2026-07-27\""),
                invalidVectors = listOf("\"2026-07-26\"", "\"not-a-date\""),
            ),
            GeneratedInvariantDefinition(
                id = GeneratedInvariantId.WEEKLY_PLAN_HAS_21_SLOTS,
                appliesTo = setOf("WeeklyPlanView", "GenerateWeeklyPlanInput"),
                owners = setOf("server", "android"),
                validVectors = listOf("{\"items\":[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]}"),
                invalidVectors = listOf("{\"items\":[]}", "21", "{\"items\":21}"),
            ),
            GeneratedInvariantDefinition(
                id = GeneratedInvariantId.SYNC_RESULTS_PRESERVE_INPUT_ORDER,
                appliesTo = setOf("SyncActionsResponse"),
                owners = setOf("server", "android"),
                validVectors = listOf("{\"inputActionIds\":[\"a\",\"b\"],\"resultActionIds\":[\"a\",\"b\"]}"),
                invalidVectors = listOf("{\"inputActionIds\":[\"a\",\"b\"],\"resultActionIds\":[\"b\",\"a\"]}", "{\"inputActionIds\":[\"a\"],\"resultActionIds\":[\"a\",\"b\"]}"),
            ),
            GeneratedInvariantDefinition(
                id = GeneratedInvariantId.SERVER_VERSION_WITHIN_DB_BIGINT,
                appliesTo = setOf("ServerVersion"),
                owners = setOf("server", "android", "database"),
                validVectors = listOf("\"1\"", "\"9223372036854775807\""),
                invalidVectors = listOf("\"0\"", "\"9223372036854775808\"", "\"01\""),
            ),
            GeneratedInvariantDefinition(
                id = GeneratedInvariantId.CONFIRMATION_STATE_FIELDS_MATCH,
                appliesTo = setOf("ConfirmationEventDto"),
                owners = setOf("server", "android"),
                validVectors = listOf("{\"state\":\"pending\",\"confirmationToken\":\"token-1\"}", "{\"state\":\"expired\"}"),
                invalidVectors = listOf("{\"state\":\"pending\"}", "{\"state\":\"consumed\",\"confirmationToken\":\"token-1\"}", "{\"state\":\"unknown\"}"),
            ),
        )

    val invariantMap: Map<GeneratedInvariantId, GeneratedInvariantDefinition> =
        invariantDefinitions.associateBy { it.id }

    val invariants: Set<GeneratedInvariantId> = invariantMap.keys

    fun validateEventData(schemaId: String, json: Json, data: String): String? =
        runCatching {
            when (schemaId) {
                "SseStartEvent" -> json.decodeFromString<SseStartEvent>(data)
                "SseDeltaEvent" -> json.decodeFromString<SseDeltaEvent>(data)
                "SseToolStatusEvent" -> json.decodeFromString<SseToolStatusEvent>(data)
                "SseConfirmationRequiredEvent" -> json.decodeFromString<ConfirmationEventDto>(data)
                "SseErrorEvent" -> json.decodeFromString<SseErrorEvent>(data)
                "SseDoneEvent" -> json.decodeFromString<SseDoneEvent>(data)
                else -> error("Unknown SSE event schema: $schemaId")
            }
        }.fold(
            onSuccess = { null },
            onFailure = { error -> error.message ?: "Invalid event data" },
        )
}
