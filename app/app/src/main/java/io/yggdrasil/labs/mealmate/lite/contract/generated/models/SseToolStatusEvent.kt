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
 * @param toolCallId
 * @param toolName
 * @param status
 * @param replayed
 */
@Serializable

data class SseToolStatusEvent (

    @SerialName(value = "toolCallId")
    val toolCallId: kotlin.String,

    @SerialName(value = "toolName")
    val toolName: kotlin.String,

    @SerialName(value = "status")
    val status: SseToolStatusEvent.Status,

    @SerialName(value = "replayed")
    val replayed: kotlin.Boolean? = null

) {

    /**
     *
     *
     * Values: started,succeeded,failed
     */
    @Serializable
    enum class Status(val value: kotlin.String) {
        @SerialName(value = "started") started("started"),
        @SerialName(value = "succeeded") succeeded("succeeded"),
        @SerialName(value = "failed") failed("failed");
    }

}
