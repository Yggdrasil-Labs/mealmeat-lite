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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOf1Payload

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Contextual

/**
 *
 *
 * @param actionId 小写 canonical UUID 格式
 * @param type
 * @param createdAt UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset
 * @param payload
 */
@Serializable

data class SyncActionDtoOneOf1 (

    /* 小写 canonical UUID 格式 */
    @Contextual @SerialName(value = "actionId")
    val actionId: java.util.UUID,

    @SerialName(value = "type")
    val type: kotlin.String,

    /* UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset */
    @Contextual @SerialName(value = "createdAt")
    val createdAt: java.time.OffsetDateTime,

    @SerialName(value = "payload")
    val payload: SyncActionDtoOneOf1Payload

) {


}
