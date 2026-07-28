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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.GenerateWeeklyPlanInputItemsInner

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Contextual

/**
 *
 *
 * @param weekStart 必须是周一的 ISO 日期
 * @param items
 */
@Serializable

data class GenerateWeeklyPlanInput (

    /* 必须是周一的 ISO 日期 */
    @Contextual @SerialName(value = "weekStart")
    val weekStart: java.time.LocalDate,

    @SerialName(value = "items")
    val items: kotlin.collections.List<GenerateWeeklyPlanInputItemsInner>

) {


}
