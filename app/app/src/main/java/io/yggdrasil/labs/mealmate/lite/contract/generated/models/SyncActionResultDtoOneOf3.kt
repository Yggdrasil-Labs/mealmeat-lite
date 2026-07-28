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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionResultDtoOneOf3Original

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Contextual

/**
 *
 *
 * @param actionId 小写 canonical UUID 格式
 * @param status
 * @param original
 */
@Serializable

data class SyncActionResultDtoOneOf3 (

    /* 小写 canonical UUID 格式 */
    @Contextual @SerialName(value = "actionId")
    val actionId: java.util.UUID,

    @SerialName(value = "status")
    val status: kotlin.String,

    @SerialName(value = "original")
    val original: SyncActionResultDtoOneOf3Original

) {


}
