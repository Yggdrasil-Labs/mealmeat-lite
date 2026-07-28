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
 * @param confirmationRequired
 * @param count
 * @param skippedDuplicates
 * @param expiresAt UTC RFC 3339 时间戳
 */
@Serializable
data class BatchGenerateRecipesOutput(
    @SerialName(value = "confirmationRequired")
    val confirmationRequired: kotlin.String,
    @SerialName(value = "count")
    val count: kotlin.Int,
    @SerialName(value = "skippedDuplicates")
    val skippedDuplicates: kotlin.collections.List<kotlin.String>,
    // UTC RFC 3339 时间戳
    @Contextual @SerialName(value = "expiresAt")
    val expiresAt: java.time.OffsetDateTime,
)
