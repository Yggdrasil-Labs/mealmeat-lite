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
 * @param role
 * @param content
 * @param chatRequestId UUID v7 格式
 * @param createdAt UTC RFC 3339 时间戳
 */
@Serializable
data class ChatMessage(
    @SerialName(value = "role")
    val role: ChatMessage.Role,
    @SerialName(value = "content")
    val content: kotlin.String,
    // UUID v7 格式
    @Contextual @SerialName(value = "chatRequestId")
    val chatRequestId: java.util.UUID,
    // UTC RFC 3339 时间戳
    @Contextual @SerialName(value = "createdAt")
    val createdAt: java.time.OffsetDateTime,
) {
    /**
     *
     *
     * Values: user,assistant
     */
    @Serializable
    enum class Role(
        val value: kotlin.String,
    ) {
        @SerialName(value = "user")
        user("user"),

        @SerialName(value = "assistant")
        assistant("assistant"),
    }
}
