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

import kotlinx.serialization.Contextual
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 *
 *
 * @param id UUID v7 格式
 * @param deletedAt UTC RFC 3339 时间戳
 * @param serverVersion 服务端版本号，正整数十进制字符串，上限 9223372036854775807
 */
@Serializable
data class DeleteRecipeOutput(
    // UUID v7 格式
    @Contextual @SerialName(value = "id")
    val id: java.util.UUID,
    // UTC RFC 3339 时间戳
    @Contextual @SerialName(value = "deletedAt")
    val deletedAt: java.time.OffsetDateTime,
    // 服务端版本号，正整数十进制字符串，上限 9223372036854775807
    @SerialName(value = "serverVersion")
    val serverVersion: kotlin.String,
)
