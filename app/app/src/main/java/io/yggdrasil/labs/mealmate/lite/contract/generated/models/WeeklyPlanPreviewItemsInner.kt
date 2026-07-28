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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.MealType
import kotlinx.serialization.Contextual
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 *
 *
 * @param date ISO 日期 YYYY-MM-DD
 * @param mealType
 * @param recipeId UUID v7 格式
 * @param recipeNameSnapshot
 */
@Serializable
data class WeeklyPlanPreviewItemsInner(
    // ISO 日期 YYYY-MM-DD
    @Contextual @SerialName(value = "date")
    val date: java.time.LocalDate,
    @Contextual @SerialName(value = "mealType")
    val mealType: MealType,
    // UUID v7 格式
    @Contextual @SerialName(value = "recipeId")
    val recipeId: java.util.UUID,
    @SerialName(value = "recipeNameSnapshot")
    val recipeNameSnapshot: kotlin.String,
)
