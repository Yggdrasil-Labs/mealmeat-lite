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
 * @param deviceId 小写 canonical UUID 格式
 * @param deviceToken
 * @param familyCode
 */
@Serializable

data class BootstrapResponse (

    /* 小写 canonical UUID 格式 */
    @Contextual @SerialName(value = "deviceId")
    val deviceId: java.util.UUID,

    @SerialName(value = "deviceToken")
    val deviceToken: kotlin.String,

    @SerialName(value = "familyCode")
    val familyCode: kotlin.String

) {


}
