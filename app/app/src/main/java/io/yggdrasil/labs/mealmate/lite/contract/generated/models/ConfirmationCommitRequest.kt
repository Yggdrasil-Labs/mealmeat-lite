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
 * @param confirmationToken
 * @param commitActionId UUID v7 格式
 */
@Serializable
data class ConfirmationCommitRequest(
    @SerialName(value = "confirmationToken")
    val confirmationToken: kotlin.String,
    // UUID v7 格式
    @Contextual @SerialName(value = "commitActionId")
    val commitActionId: java.util.UUID,
)
