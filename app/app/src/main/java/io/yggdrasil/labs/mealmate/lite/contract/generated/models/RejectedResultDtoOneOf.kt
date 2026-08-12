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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.AppliedResultDtoResource

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
 * @param authoritative
 * @param serverVersion 服务端版本号，正整数十进制字符串，上限 9223372036854775807
 */
@Serializable

data class RejectedResultDtoOneOf (

    @SerialName(value = "status")
    val status: kotlin.String,

    @SerialName(value = "errCode")
    val errCode: kotlin.String,

    @SerialName(value = "errMessage")
    val errMessage: kotlin.String,

    @SerialName(value = "requiresFullResync")
    @Serializable(with = io.yggdrasil.labs.mealmate.lite.contract.BooleanConstFalseSerializer::class)
    val requiresFullResync: kotlin.Boolean,

    @SerialName(value = "authoritative")
    val authoritative: AppliedResultDtoResource,

    /* 服务端版本号，正整数十进制字符串，上限 9223372036854775807 */
    @SerialName(value = "serverVersion")
    val serverVersion: kotlin.String

) {

    /**
     *
     *
     * Values: `false`
     */
    @Serializable
    enum class RequiresFullResync(val value: kotlin.Boolean) {
        @SerialName(value = "false") `false`(false);
    }

}
