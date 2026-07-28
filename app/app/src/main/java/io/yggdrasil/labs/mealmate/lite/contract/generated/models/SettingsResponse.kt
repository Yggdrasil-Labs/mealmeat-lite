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
 * @param familyPreference
 * @param serverVersion 服务端版本号，正整数十进制字符串，上限 9223372036854775807
 */
@Serializable

data class SettingsResponse (

    @SerialName(value = "familyPreference")
    val familyPreference: kotlin.String,

    /* 服务端版本号，正整数十进制字符串，上限 9223372036854775807 */
    @SerialName(value = "serverVersion")
    val serverVersion: kotlin.String

) {


}
