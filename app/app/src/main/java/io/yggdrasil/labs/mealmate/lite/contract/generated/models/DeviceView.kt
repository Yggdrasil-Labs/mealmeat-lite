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
 * @param deviceName
 * @param createdAt UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset
 * @param lastUsedAt UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset
 * @param isCurrent
 */
@Serializable

data class DeviceView (

    /* 小写 canonical UUID 格式 */
    @Contextual @SerialName(value = "id")
    val id: java.util.UUID,

    @SerialName(value = "deviceName")
    val deviceName: kotlin.String,

    /* UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset */
    @Contextual @SerialName(value = "createdAt")
    val createdAt: java.time.OffsetDateTime,

    /* UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset */
    @Contextual @SerialName(value = "lastUsedAt")
    val lastUsedAt: java.time.OffsetDateTime,

    @SerialName(value = "isCurrent")
    val isCurrent: kotlin.Boolean

) {


}
