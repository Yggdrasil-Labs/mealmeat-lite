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
 * @param success
 * @param `data`
 */
@Serializable

data class SuccessResponse (

    @SerialName(value = "success")
    @Serializable(with = io.yggdrasil.labs.mealmate.lite.contract.BooleanConstTrueSerializer::class)
    val success: kotlin.Boolean,

    @Contextual @SerialName(value = "data")
    val `data`: kotlin.Any?

) {

    /**
     *
     *
     * Values: `true`
     */
    @Serializable
    enum class Success(val value: kotlin.Boolean) {
        @SerialName(value = "true") `true`(true);
    }

}
