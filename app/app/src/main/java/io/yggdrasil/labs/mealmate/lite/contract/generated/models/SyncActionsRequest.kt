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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDto
import kotlinx.serialization.Contextual
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 *
 *
 * @param actions
 */
@Serializable
data class SyncActionsRequest(
    @SerialName(value = "actions")
    val actions: kotlin.collections.List<SyncActionDto>,
)
