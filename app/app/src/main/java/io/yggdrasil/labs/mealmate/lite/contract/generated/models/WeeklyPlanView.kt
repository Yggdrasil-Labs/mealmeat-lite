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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.PlanItemView
import kotlinx.serialization.Contextual
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 *
 *
 * @param id UUID v7 格式
 * @param weekStart 必须是周一的 ISO 日期
 * @param serverVersion 服务端版本号，正整数十进制字符串，上限 9223372036854775807
 * @param items
 * @param createdAt UTC RFC 3339 时间戳
 * @param updatedAt UTC RFC 3339 时间戳
 */
@Serializable
data class WeeklyPlanView(
    // UUID v7 格式
    @Contextual @SerialName(value = "id")
    val id: java.util.UUID,
    // 必须是周一的 ISO 日期
    @Contextual @SerialName(value = "weekStart")
    val weekStart: java.time.LocalDate,
    // 服务端版本号，正整数十进制字符串，上限 9223372036854775807
    @SerialName(value = "serverVersion")
    val serverVersion: kotlin.String,
    @SerialName(value = "items")
    val items: kotlin.collections.List<PlanItemView>,
    // UTC RFC 3339 时间戳
    @Contextual @SerialName(value = "createdAt")
    val createdAt: java.time.OffsetDateTime,
    // UTC RFC 3339 时间戳
    @Contextual @SerialName(value = "updatedAt")
    val updatedAt: java.time.OffsetDateTime,
)
