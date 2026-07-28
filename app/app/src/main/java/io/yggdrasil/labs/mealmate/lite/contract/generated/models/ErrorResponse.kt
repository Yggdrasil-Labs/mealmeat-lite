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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ErrorResponseDetailsInner

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Contextual

/**
 *
 *
 * @param success
 * @param errCode
 * @param errMessage
 * @param requestId
 * @param retryable
 * @param details
 */
@Serializable

data class ErrorResponse (

    @SerialName(value = "success")
    val success: kotlin.String,

    @SerialName(value = "errCode")
    val errCode: kotlin.String,

    @SerialName(value = "errMessage")
    val errMessage: kotlin.String,

    @SerialName(value = "requestId")
    val requestId: kotlin.String,

    @SerialName(value = "retryable")
    val retryable: kotlin.Boolean,

    @SerialName(value = "details")
    val details: kotlin.collections.List<ErrorResponseDetailsInner>? = null

) {


}
