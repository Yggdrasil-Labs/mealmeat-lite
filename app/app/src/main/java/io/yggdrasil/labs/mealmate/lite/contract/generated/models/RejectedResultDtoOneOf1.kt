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
 * @param status
 * @param errCode
 * @param errMessage
 * @param requiresFullResync
 */
@Serializable
data class RejectedResultDtoOneOf1(
    @SerialName(value = "status")
    val status: kotlin.String,
    @SerialName(value = "errCode")
    val errCode: kotlin.String,
    @SerialName(value = "errMessage")
    val errMessage: kotlin.String,
    @SerialName(value = "requiresFullResync")
    val requiresFullResync: kotlin.String,
)
