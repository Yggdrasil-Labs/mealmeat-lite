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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOf
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOf1
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOf1Payload

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
@Serializable(with = SyncActionDtoSerializer::class)
sealed interface SyncActionDto {
    @JvmInline
    value class SyncActionDtoOneOfValue(val value: SyncActionDtoOneOf) : SyncActionDto

    @JvmInline
    value class SyncActionDtoOneOf1Value(val value: SyncActionDtoOneOf1) : SyncActionDto

}

object SyncActionDtoSerializer : KSerializer<SyncActionDto> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("SyncActionDto")

    override fun serialize(encoder: Encoder, value: SyncActionDto) {
        val jsonEncoder = encoder as? JsonEncoder ?: throw SerializationException("SyncActionDto can only be serialized with Json")

        when (value) {
            is SyncActionDto.SyncActionDtoOneOfValue -> jsonEncoder.encodeSerializableValue(SyncActionDtoOneOf.serializer(), value.value)
            is SyncActionDto.SyncActionDtoOneOf1Value -> jsonEncoder.encodeSerializableValue(SyncActionDtoOneOf1.serializer(), value.value)
        }
    }

    override fun deserialize(decoder: Decoder): SyncActionDto {
        val jsonDecoder = decoder as? JsonDecoder ?: throw SerializationException("SyncActionDto can only be deserialized with Json")
        val jsonElement = jsonDecoder.decodeJsonElement()

        val errorMessages = mutableListOf<String>()

        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<SyncActionDtoOneOf>(jsonElement)
                return SyncActionDto.SyncActionDtoOneOfValue(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as SyncActionDtoOneOf: ${e.message}")
            }
        }
        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<SyncActionDtoOneOf1>(jsonElement)
                return SyncActionDto.SyncActionDtoOneOf1Value(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as SyncActionDtoOneOf1: ${e.message}")
            }
        }

        throw SerializationException("Cannot deserialize SyncActionDto. Tried: ${errorMessages.joinToString(", ")}")
    }
}
