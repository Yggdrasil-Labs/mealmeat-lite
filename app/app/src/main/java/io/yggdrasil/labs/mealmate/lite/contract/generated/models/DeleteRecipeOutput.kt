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
 * @param deletedAt UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset
 * @param serverVersion 服务端版本号，正整数十进制字符串，上限 9223372036854775807
 */
@Serializable

data class DeleteRecipeOutput (

    /* 小写 canonical UUID 格式 */
    @Contextual @SerialName(value = "id")
    val id: java.util.UUID,

    /* UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset */
    @Contextual @SerialName(value = "deletedAt")
    val deletedAt: java.time.OffsetDateTime,

    /* 服务端版本号，正整数十进制字符串，上限 9223372036854775807 */
    @SerialName(value = "serverVersion")
    val serverVersion: kotlin.String

) {


}
