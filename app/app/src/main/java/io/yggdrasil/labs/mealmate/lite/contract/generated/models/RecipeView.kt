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
 * @param id UUID v7 格式
 * @param name
 * @param tags
 * @param ingredients
 * @param steps
 * @param serverVersion 服务端版本号，正整数十进制字符串，上限 9223372036854775807
 * @param createdAt UTC RFC 3339 时间戳
 * @param updatedAt UTC RFC 3339 时间戳
 * @param imageUrl
 * @param notes
 */
@Serializable
data class RecipeView(
    // UUID v7 格式
    @Contextual @SerialName(value = "id")
    val id: java.util.UUID,
    @SerialName(value = "name")
    val name: kotlin.String,
    @SerialName(value = "tags")
    val tags: kotlin.collections.List<kotlin.String>,
    @SerialName(value = "ingredients")
    val ingredients: kotlin.collections.List<kotlin.String>,
    @SerialName(value = "steps")
    val steps: kotlin.collections.List<kotlin.String>,
    // 服务端版本号，正整数十进制字符串，上限 9223372036854775807
    @SerialName(value = "serverVersion")
    val serverVersion: kotlin.String,
    // UTC RFC 3339 时间戳
    @Contextual @SerialName(value = "createdAt")
    val createdAt: java.time.OffsetDateTime,
    // UTC RFC 3339 时间戳
    @Contextual @SerialName(value = "updatedAt")
    val updatedAt: java.time.OffsetDateTime,
    @Contextual @SerialName(value = "imageUrl")
    val imageUrl: kotlin.String? = null,
    @SerialName(value = "notes")
    val notes: kotlin.String? = null,
)
