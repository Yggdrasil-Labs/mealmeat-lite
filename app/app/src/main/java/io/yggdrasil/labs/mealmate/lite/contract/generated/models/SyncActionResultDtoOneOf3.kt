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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionResultDtoOneOf3Original
import kotlinx.serialization.Contextual
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 *
 *
 * @param actionId UUID v7 格式
 * @param status
 * @param original
 */
@Serializable
data class SyncActionResultDtoOneOf3(
    // UUID v7 格式
    @Contextual @SerialName(value = "actionId")
    val actionId: java.util.UUID,
    @SerialName(value = "status")
    val status: kotlin.String,
    @SerialName(value = "original")
    val original: SyncActionResultDtoOneOf3Original,
)
