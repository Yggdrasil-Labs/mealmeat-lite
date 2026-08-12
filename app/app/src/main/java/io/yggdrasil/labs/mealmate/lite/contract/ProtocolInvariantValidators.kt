package io.yggdrasil.labs.mealmate.lite.contract

import io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedProtocolCatalog
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.math.BigInteger
import java.time.DayOfWeek
import java.time.LocalDate

private const val MAX_BIGINT = "9223372036854775807"
private val POSITIVE_INTEGER_PATTERN = Regex("^[1-9][0-9]*$")

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
    val raw =
        InvariantValueReader.stringValue(value)
            ?: return validationFailure("Expected date string, got ${value?.javaClass?.simpleName}")
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
        } ?: return validationFailure("Expected object with items array")
    return if (count == 21) {
        ContractValidationResult(success = true, value = value)
    } else {
        validationFailure("Weekly plan must have 21 slots (7 days × 3 meals), got $count")
    }
}

private fun validateSyncResultsPreserveInputOrder(value: Any?): ContractValidationResult<Any?> {
    val ids =
        when (value) {
            is SyncResultsOrderInput -> value.inputActionIds to value.resultActionIds
            is JsonObject -> InvariantValueReader.syncOrderIds(value)
            is Map<*, *> -> InvariantValueReader.syncOrderIds(value)
            else -> return validationFailure("Expected sync order object")
        } ?: return validationFailure("Expected inputActionIds and resultActionIds arrays")
    return if (ids.first == ids.second) {
        ContractValidationResult(success = true, value = value)
    } else {
        validationFailure("Sync result actionIds must preserve input order")
    }
}

private fun validateServerVersionWithinDbBigint(value: Any?): ContractValidationResult<Any?> {
    val raw =
        InvariantValueReader.stringValue(value)
            ?: return validationFailure("Expected string, got ${value?.javaClass?.simpleName}")
    if (!POSITIVE_INTEGER_PATTERN.matches(raw)) {
        return validationFailure("Invalid server version format: $raw")
    }
    val version =
        runCatching { BigInteger(raw) }.getOrNull()
            ?: return validationFailure("Invalid server version format: $raw")
    return if (version in BigInteger.ONE..BigInteger(MAX_BIGINT)) {
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
        confirmationFields(value, rule.stateField, rule.tokenField)
            ?: return validationFailure("Expected confirmation state object")
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

private fun confirmationFields(
    value: Any?,
    stateField: String,
    tokenField: String,
): ConfirmationInvariantFields? =
    when (value) {
        is ConfirmationStateFieldsInput -> {
            ConfirmationInvariantFields(value.state, value.confirmationToken != null, value.confirmationToken)
        }

        is JsonObject -> {
            ConfirmationInvariantFields(
                state = InvariantValueReader.requiredString(value, stateField),
                hasToken = value.containsKey(tokenField) && value[tokenField] != null,
                token = value[tokenField]?.let(InvariantValueReader::stringValue),
            )
        }

        is Map<*, *> -> {
            ConfirmationInvariantFields(
                state = value[stateField] as? String,
                hasToken = value.containsKey(tokenField) && value[tokenField] != null,
                token = value[tokenField] as? String,
            )
        }

        else -> {
            null
        }
    }

private data class ConfirmationInvariantFields(
    val state: String?,
    val hasToken: Boolean,
    val token: String?,
)

private object InvariantValueReader {
    fun requiredString(
        value: JsonObject,
        field: String,
    ): String? = (value[field] as? JsonPrimitive)?.takeIf { it.isString }?.content?.takeIf { it.isNotEmpty() }

    fun stringValue(value: JsonElement): String? = (value as? JsonPrimitive)?.takeIf { it.isString }?.content

    fun stringValue(value: Any?): String? =
        when (value) {
            is String -> value
            is JsonElement -> stringValue(value)
            else -> null
        }

    fun stringArray(
        value: JsonObject,
        field: String,
    ): List<String>? = (value[field] as? JsonArray)?.let(::stringValues)

    fun syncOrderIds(value: JsonObject): Pair<List<String>, List<String>>? =
        stringArray(value, "inputActionIds")?.let { input ->
            stringArray(value, "resultActionIds")?.let { result -> input to result }
        }

    private fun stringValues(value: JsonArray): List<String>? {
        val values = mutableListOf<String>()
        for (element in value) {
            val item = stringValue(element) ?: return null
            values += item
        }
        return values
    }

    fun stringList(
        value: Map<*, *>,
        field: String,
    ): List<String>? {
        val values = value[field] as? List<*> ?: return null
        if (values.any { it !is String }) return null
        @Suppress("UNCHECKED_CAST")
        return values as List<String>
    }

    fun syncOrderIds(value: Map<*, *>): Pair<List<String>, List<String>>? =
        stringList(value, "inputActionIds")?.let { input ->
            stringList(value, "resultActionIds")?.let { result -> input to result }
        }
}
