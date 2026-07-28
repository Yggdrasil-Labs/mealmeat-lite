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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.AppliedResultDtoResource
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RejectedResultDtoOneOf
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RejectedResultDtoOneOf1

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Contextual
import kotlinx.serialization.KSerializer
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement

/**
 *
 *
 */
@Serializable(with = RejectedResultDtoSerializer::class)
sealed interface RejectedResultDto {
    @JvmInline
    value class RejectedResultDtoOneOfValue(val value: RejectedResultDtoOneOf) : RejectedResultDto

    @JvmInline
    value class RejectedResultDtoOneOf1Value(val value: RejectedResultDtoOneOf1) : RejectedResultDto

}

object RejectedResultDtoSerializer : KSerializer<RejectedResultDto> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("RejectedResultDto")

    override fun serialize(encoder: Encoder, value: RejectedResultDto) {
        val jsonEncoder = encoder as? JsonEncoder ?: throw SerializationException("RejectedResultDto can only be serialized with Json")

        when (value) {
            is RejectedResultDto.RejectedResultDtoOneOfValue -> jsonEncoder.encodeSerializableValue(RejectedResultDtoOneOf.serializer(), value.value)
            is RejectedResultDto.RejectedResultDtoOneOf1Value -> jsonEncoder.encodeSerializableValue(RejectedResultDtoOneOf1.serializer(), value.value)
        }
    }

    override fun deserialize(decoder: Decoder): RejectedResultDto {
        val jsonDecoder = decoder as? JsonDecoder ?: throw SerializationException("RejectedResultDto can only be deserialized with Json")
        val jsonElement = jsonDecoder.decodeJsonElement()

        val errorMessages = mutableListOf<String>()

        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<RejectedResultDtoOneOf>(jsonElement)
                return RejectedResultDto.RejectedResultDtoOneOfValue(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as RejectedResultDtoOneOf: ${e.message}")
            }
        }
        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<RejectedResultDtoOneOf1>(jsonElement)
                return RejectedResultDto.RejectedResultDtoOneOf1Value(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as RejectedResultDtoOneOf1: ${e.message}")
            }
        }

        throw SerializationException("Cannot deserialize RejectedResultDto. Tried: ${errorMessages.joinToString(", ")}")
    }
}
