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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.UpdateRecipeInputPatch

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Contextual

/**
 *
 *
 * @param recipeId 小写 canonical UUID 格式
 * @param patch
 */
@Serializable

data class UpdateRecipeInput (

    /* 小写 canonical UUID 格式 */
    @Contextual @SerialName(value = "recipeId")
    val recipeId: java.util.UUID,

    @SerialName(value = "patch")
    val patch: UpdateRecipeInputPatch

) {


}
