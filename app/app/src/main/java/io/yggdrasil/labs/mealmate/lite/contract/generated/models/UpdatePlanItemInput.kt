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
 * @param planItemId 小写 canonical UUID 格式
 * @param recipeId 小写 canonical UUID 格式
 */
@Serializable

data class UpdatePlanItemInput (

    /* 小写 canonical UUID 格式 */
    @Contextual @SerialName(value = "planItemId")
    val planItemId: java.util.UUID,

    /* 小写 canonical UUID 格式 */
    @Contextual @SerialName(value = "recipeId")
    val recipeId: java.util.UUID

) {


}
