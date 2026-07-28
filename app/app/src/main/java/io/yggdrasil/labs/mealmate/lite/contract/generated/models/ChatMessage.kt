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
 * @param role
 * @param content
 * @param chatRequestId 小写 canonical UUID 格式
 * @param createdAt UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset
 */
@Serializable

data class ChatMessage (

    @SerialName(value = "role")
    val role: ChatMessage.Role,

    @SerialName(value = "content")
    val content: kotlin.String,

    /* 小写 canonical UUID 格式 */
    @Contextual @SerialName(value = "chatRequestId")
    val chatRequestId: java.util.UUID,

    /* UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset */
    @Contextual @SerialName(value = "createdAt")
    val createdAt: java.time.OffsetDateTime

) {

    /**
     *
     *
     * Values: user,assistant
     */
    @Serializable
    enum class Role(val value: kotlin.String) {
        @SerialName(value = "user") user("user"),
        @SerialName(value = "assistant") assistant("assistant");
    }

}
