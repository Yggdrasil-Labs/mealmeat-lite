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
 * @param id 小写 canonical UUID 格式
 * @param revoked
 */
@Serializable

data class RevokeDeviceResponse (

    /* 小写 canonical UUID 格式 */
    @Contextual @SerialName(value = "id")
    val id: java.util.UUID,

    @SerialName(value = "revoked")
    @Serializable(with = io.yggdrasil.labs.mealmate.lite.contract.BooleanConstTrueSerializer::class)
    val revoked: kotlin.Boolean

) {

    /**
     *
     *
     * Values: `true`
     */
    @Serializable
    enum class Revoked(val value: kotlin.Boolean) {
        @SerialName(value = "true") `true`(true);
    }

}
