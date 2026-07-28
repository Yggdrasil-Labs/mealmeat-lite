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
 * @param chatRequestId 小写 canonical UUID 格式
 * @param modelId
 * @param message
 */
@Serializable

data class ChatRequest (

    /* 小写 canonical UUID 格式 */
    @Contextual @SerialName(value = "chatRequestId")
    val chatRequestId: java.util.UUID,

    @SerialName(value = "modelId")
    val modelId: kotlin.String,

    @SerialName(value = "message")
    val message: kotlin.String

) {


}
