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
 * @param status
 * @param errCode
 * @param errMessage
 * @param requiresFullResync
 */
@Serializable

data class RejectedResultDtoOneOf1 (

    @SerialName(value = "status")
    val status: kotlin.String,

    @SerialName(value = "errCode")
    val errCode: kotlin.String,

    @SerialName(value = "errMessage")
    val errMessage: kotlin.String,

    @SerialName(value = "requiresFullResync")
    @Serializable(with = io.yggdrasil.labs.mealmate.lite.contract.BooleanConstTrueSerializer::class)
    val requiresFullResync: kotlin.Boolean

) {

    /**
     *
     *
     * Values: `true`
     */
    @Serializable
    enum class RequiresFullResync(val value: kotlin.Boolean) {
        @SerialName(value = "true") `true`(true);
    }

}
