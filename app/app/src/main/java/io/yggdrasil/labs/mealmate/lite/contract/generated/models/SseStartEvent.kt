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
 * @param chatRequestId UUID v7 格式
 * @param replayed
 * @param resumed
 */
@Serializable
data class SseStartEvent(
    // UUID v7 格式
    @Contextual @SerialName(value = "chatRequestId")
    val chatRequestId: java.util.UUID,
    @SerialName(value = "replayed")
    val replayed: kotlin.Boolean,
    @SerialName(value = "resumed")
    val resumed: kotlin.Boolean,
)
