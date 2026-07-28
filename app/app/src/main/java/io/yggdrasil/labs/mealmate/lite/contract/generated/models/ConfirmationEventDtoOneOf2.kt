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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.WeeklyPlanPreview
import kotlinx.serialization.Contextual
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 *
 *
 * @param confirmationId UUID v7 格式
 * @param kind
 * @param state
 * @param expiresAt UTC RFC 3339 时间戳
 * @param confirmationToken
 * @param preview
 */
@Serializable
data class ConfirmationEventDtoOneOf2(
    // UUID v7 格式
    @Contextual @SerialName(value = "confirmationId")
    val confirmationId: java.util.UUID,
    @SerialName(value = "kind")
    val kind: kotlin.String,
    @SerialName(value = "state")
    val state: kotlin.String,
    // UTC RFC 3339 时间戳
    @Contextual @SerialName(value = "expiresAt")
    val expiresAt: java.time.OffsetDateTime,
    @SerialName(value = "confirmationToken")
    val confirmationToken: kotlin.String,
    @SerialName(value = "preview")
    val preview: WeeklyPlanPreview,
)
