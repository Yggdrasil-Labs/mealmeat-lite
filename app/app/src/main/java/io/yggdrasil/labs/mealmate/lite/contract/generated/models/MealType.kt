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

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * 餐次类型
 *
 * Values: breakfast,lunch,dinner
 */
@Serializable
enum class MealType(
    val value: kotlin.String,
) {
    @SerialName(value = "breakfast")
    breakfast("breakfast"),

    @SerialName(value = "lunch")
    lunch("lunch"),

    @SerialName(value = "dinner")
    dinner("dinner"),
    ;

    /**
     * Override [toString()] to avoid using the enum variable name as the value, and instead use
     * the actual value defined in the API spec file.
     *
     * This solves a problem when the variable name and its value are different, and ensures that
     * the client sends the correct enum values to the server always.
     */
    override fun toString(): kotlin.String = value

    companion object {
        /**
         * Converts the provided [data] to a [String] on success, null otherwise.
         */
        fun encode(data: kotlin.Any?): kotlin.String? = if (data is MealType) "$data" else null

        /**
         * Returns a valid [MealType] for [data], null otherwise.
         */
        fun decode(data: kotlin.Any?): MealType? =
            data?.let {
                val normalizedData = "$it".lowercase()
                entries.firstOrNull { value ->
                    it == value || normalizedData == "$value".lowercase()
                }
            }
    }
}
