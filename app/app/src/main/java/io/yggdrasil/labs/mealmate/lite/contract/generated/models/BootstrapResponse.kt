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
 * @param deviceId UUID v7 格式
 * @param deviceToken
 * @param familyCode
 */
@Serializable
data class BootstrapResponse(
    // UUID v7 格式
    @Contextual @SerialName(value = "deviceId")
    val deviceId: java.util.UUID,
    @SerialName(value = "deviceToken")
    val deviceToken: kotlin.String,
    @SerialName(value = "familyCode")
    val familyCode: kotlin.String,
)
