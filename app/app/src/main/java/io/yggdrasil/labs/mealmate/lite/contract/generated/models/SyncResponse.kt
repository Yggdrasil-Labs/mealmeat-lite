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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDto
import kotlinx.serialization.Contextual
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 *
 *
 * @param changes
 * @param hasMore
 * @param nextCursor
 */
@Serializable
data class SyncResponse(
    @SerialName(value = "changes")
    val changes: kotlin.collections.List<SyncChangeDto>,
    @SerialName(value = "hasMore")
    val hasMore: kotlin.Boolean,
    @SerialName(value = "nextCursor")
    val nextCursor: kotlin.String? = null,
)
