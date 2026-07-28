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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeView
import kotlinx.serialization.Contextual
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 *
 *
 * @param items
 * @param hasMore
 * @param nextCursor
 */
@Serializable
data class RecipeListResponse(
    @SerialName(value = "items")
    val items: kotlin.collections.List<RecipeView>,
    @SerialName(value = "hasMore")
    val hasMore: kotlin.Boolean,
    @SerialName(value = "nextCursor")
    val nextCursor: kotlin.String? = null,
)
