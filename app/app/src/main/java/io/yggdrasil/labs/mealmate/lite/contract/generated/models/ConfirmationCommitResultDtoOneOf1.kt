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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.WeeklyPlanUpsertChangeDto

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Contextual

/**
 *
 *
 * @param kind
 * @param changes
 */
@Serializable

data class ConfirmationCommitResultDtoOneOf1 (

    @SerialName(value = "kind")
    val kind: kotlin.String,

    @SerialName(value = "changes")
    val changes: kotlin.collections.List<WeeklyPlanUpsertChangeDto>

) {


}
