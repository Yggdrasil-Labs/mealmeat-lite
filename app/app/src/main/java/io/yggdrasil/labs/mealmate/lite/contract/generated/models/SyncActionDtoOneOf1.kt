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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOf1Payload
import kotlinx.serialization.Contextual
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 *
 *
 * @param actionId UUID v7 格式
 * @param type
 * @param createdAt UTC RFC 3339 时间戳
 * @param payload
 */
@Serializable
data class SyncActionDtoOneOf1(
    // UUID v7 格式
    @Contextual @SerialName(value = "actionId")
    val actionId: java.util.UUID,
    @SerialName(value = "type")
    val type: kotlin.String,
    // UTC RFC 3339 时间戳
    @Contextual @SerialName(value = "createdAt")
    val createdAt: java.time.OffsetDateTime,
    @SerialName(value = "payload")
    val payload: SyncActionDtoOneOf1Payload,
)
