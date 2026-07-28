@file:Suppress(
    "ArrayInDataClass",
    "DuplicatedCode",
    "EnumEntryName",
    "RemoveRedundantQualifierName",
    "RemoveRedundantCallsOfConversionMethods",
    "REDUNDANT_CALL_OF_CONVERSION_METHOD",
    "RedundantUnitReturnType",
    "RemoveEmptyClassBody",
    "UnnecessaryVariable",
    "UnusedImport",
    "UnnecessaryVariable",
    "unused",
)

package io.yggdrasil.labs.mealmate.lite.contract.generated.models

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.WeeklyPlanPreview
import kotlinx.serialization.Contextual
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 *
 *
 * @param confirmationId UUID v7 格式
 * @param kind
 * @param state
 * @param expiresAt UTC RFC 3339 时间戳
 * @param preview
 */
@Serializable
data class ConfirmationEventDtoOneOf3(
    // UUID v7 格式
    @Contextual @SerialName(value = "confirmationId")
    val confirmationId: java.util.UUID,
    @SerialName(value = "kind")
    val kind: kotlin.String,
    @SerialName(value = "state")
    val state: ConfirmationEventDtoOneOf3.State,
    // UTC RFC 3339 时间戳
    @Contextual @SerialName(value = "expiresAt")
    val expiresAt: java.time.OffsetDateTime,
    @SerialName(value = "preview")
    val preview: WeeklyPlanPreview,
) {
    /**
     *
     *
     * Values: expired,superseded,consumed
     */
    @Serializable
    enum class State(
        val value: kotlin.String,
    ) {
        @SerialName(value = "expired")
        expired("expired"),

        @SerialName(value = "superseded")
        superseded("superseded"),

        @SerialName(value = "consumed")
        consumed("consumed"),
    }
}
