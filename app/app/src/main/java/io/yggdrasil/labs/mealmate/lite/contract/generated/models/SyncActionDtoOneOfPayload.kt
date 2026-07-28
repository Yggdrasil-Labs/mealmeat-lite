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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOfPayloadPatch
import kotlinx.serialization.Contextual
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 *
 *
 * @param recipeId UUID v7 格式
 * @param patch
 */
@Serializable
data class SyncActionDtoOneOfPayload(
    // UUID v7 格式
    @Contextual @SerialName(value = "recipeId")
    val recipeId: java.util.UUID,
    @SerialName(value = "patch")
    val patch: SyncActionDtoOneOfPayloadPatch,
)
