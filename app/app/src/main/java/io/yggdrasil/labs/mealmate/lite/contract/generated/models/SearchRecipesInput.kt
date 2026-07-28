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
 * @param query
 * @param tags
 * @param includeDeleted
 * @param limit
 */
@Serializable

data class SearchRecipesInput (

    @SerialName(value = "query")
    val query: kotlin.String? = null,

    @SerialName(value = "tags")
    val tags: kotlin.collections.List<kotlin.String>? = null,

    @SerialName(value = "includeDeleted")
    val includeDeleted: kotlin.Boolean? = false,

    @SerialName(value = "limit")
    val limit: kotlin.Int? = 20

) {


}
