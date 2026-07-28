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
    "unused"
)

package io.yggdrasil.labs.mealmate.lite.contract.generated.models

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeBatchPreview

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Contextual

/**
 *
 *
 * @param confirmationId 小写 canonical UUID 格式
 * @param kind
 * @param state
 * @param expiresAt UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset
 * @param preview
 */
@Serializable

data class ConfirmationEventDtoOneOf1 (

    /* 小写 canonical UUID 格式 */
    @Contextual @SerialName(value = "confirmationId")
    val confirmationId: java.util.UUID,

    @SerialName(value = "kind")
    val kind: kotlin.String,

    @SerialName(value = "state")
    val state: ConfirmationEventDtoOneOf1.State,

    /* UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset */
    @Contextual @SerialName(value = "expiresAt")
    val expiresAt: java.time.OffsetDateTime,

    @SerialName(value = "preview")
    val preview: RecipeBatchPreview

) {

    /**
     *
     *
     * Values: expired,superseded,consumed
     */
    @Serializable
    enum class State(val value: kotlin.String) {
        @SerialName(value = "expired") expired("expired"),
        @SerialName(value = "superseded") superseded("superseded"),
        @SerialName(value = "consumed") consumed("consumed");
    }

}
