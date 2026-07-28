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

import kotlinx.serialization.Contextual
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 *
 *
 * @param id
 * @param displayName
 * @param isDefault
 */
@Serializable
data class ModelView(
    @SerialName(value = "id")
    val id: kotlin.String,
    @SerialName(value = "displayName")
    val displayName: kotlin.String,
    @SerialName(value = "isDefault")
    val isDefault: kotlin.Boolean,
)
