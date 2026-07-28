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
 * @param deviceName
 * @param createdAt UTC RFC 3339 时间戳
 * @param lastUsedAt UTC RFC 3339 时间戳
 * @param isCurrent
 */
@Serializable
data class DeviceView(
    // UUID v7 格式
    @Contextual @SerialName(value = "id")
    val id: java.util.UUID,
    @SerialName(value = "deviceName")
    val deviceName: kotlin.String,
    // UTC RFC 3339 时间戳
    @Contextual @SerialName(value = "createdAt")
    val createdAt: java.time.OffsetDateTime,
    // UTC RFC 3339 时间戳
    @Contextual @SerialName(value = "lastUsedAt")
    val lastUsedAt: java.time.OffsetDateTime,
    @SerialName(value = "isCurrent")
    val isCurrent: kotlin.Boolean,
)
