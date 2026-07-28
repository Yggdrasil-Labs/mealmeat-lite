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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeView

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Contextual

/**
 *
 *
 * @param serverVersion 服务端版本号，正整数十进制字符串，上限 9223372036854775807
 * @param resource
 * @param operation
 * @param `data`
 */
@Serializable

data class RecipeUpsertChangeDto (

    /* 服务端版本号，正整数十进制字符串，上限 9223372036854775807 */
    @SerialName(value = "serverVersion")
    val serverVersion: kotlin.String,

    @SerialName(value = "resource")
    val resource: kotlin.String,

    @SerialName(value = "operation")
    val operation: kotlin.String,

    @SerialName(value = "data")
    val `data`: RecipeView

) {


}
