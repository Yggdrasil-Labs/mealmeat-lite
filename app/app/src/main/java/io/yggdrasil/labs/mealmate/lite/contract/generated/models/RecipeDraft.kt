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


import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Contextual

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

data class RecipeDraft (

    @SerialName(value = "name")
    val name: kotlin.String,

    @SerialName(value = "tags")
    val tags: kotlin.collections.List<kotlin.String>? = null,

    @SerialName(value = "ingredients")
    val ingredients: kotlin.collections.List<kotlin.String>? = null,

    @SerialName(value = "steps")
    val steps: kotlin.collections.List<kotlin.String>? = null,

    @Contextual @SerialName(value = "imageUrl")
    val imageUrl: java.net.URI? = null,

    @SerialName(value = "notes")
    val notes: kotlin.String? = null

) {


}
