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


import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Contextual

/**
 *
 *
 * @param confirmationRequired
 * @param count
 * @param skippedDuplicates
 * @param expiresAt UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset
 */
@Serializable

data class BatchGenerateRecipesOutput (

    @SerialName(value = "confirmationRequired")
    @Serializable(with = io.yggdrasil.labs.mealmate.lite.contract.BooleanConstTrueSerializer::class)
    val confirmationRequired: kotlin.Boolean,

    @SerialName(value = "count")
    val count: kotlin.Int,

    @SerialName(value = "skippedDuplicates")
    val skippedDuplicates: kotlin.collections.List<kotlin.String>,

    /* UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset */
    @Contextual @SerialName(value = "expiresAt")
    val expiresAt: java.time.OffsetDateTime

) {

    /**
     *
     *
     * Values: `true`
     */
    @Serializable
    enum class ConfirmationRequired(val value: kotlin.Boolean) {
        @SerialName(value = "true") `true`(true);
    }

}
