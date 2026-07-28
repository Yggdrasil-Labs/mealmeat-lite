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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.UpdateRecipeInputPatchImageUrl
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.UpdateRecipeInputPatchNotes
import kotlinx.serialization.Contextual
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 *
 *
 * @param name
 * @param tags
 * @param ingredients
 * @param steps
 * @param imageUrl
 * @param notes
 */
@Serializable
data class UpdateRecipeInputPatch(
    @SerialName(value = "name")
    val name: kotlin.String? = null,
    @SerialName(value = "tags")
    val tags: kotlin.collections.List<kotlin.String>? = null,
    @SerialName(value = "ingredients")
    val ingredients: kotlin.collections.List<kotlin.String>? = null,
    @SerialName(value = "steps")
    val steps: kotlin.collections.List<kotlin.String>? = null,
    @SerialName(value = "imageUrl")
    val imageUrl: UpdateRecipeInputPatchImageUrl? = null,
    @SerialName(value = "notes")
    val notes: UpdateRecipeInputPatchNotes? = null,
)
