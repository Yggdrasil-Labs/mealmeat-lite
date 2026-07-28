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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.WeeklyPlanView

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Contextual

/**
 *
 *
 * @param plan
 * @param reusedRecipeIds
 */
@Serializable

data class GenerateWeeklyPlanOutput (

    @SerialName(value = "plan")
    val plan: WeeklyPlanView,

    @SerialName(value = "reusedRecipeIds")
    val reusedRecipeIds: kotlin.collections.List<@Contextual java.util.UUID>

) {


}
