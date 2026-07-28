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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ConfirmationEventDtoOneOf
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ConfirmationEventDtoOneOf1
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ConfirmationEventDtoOneOf2
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ConfirmationEventDtoOneOf3
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.WeeklyPlanPreview
import kotlinx.serialization.Contextual
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement

/**
 *
 *
 */
@Serializable(with = ConfirmationEventDtoSerializer::class)
sealed interface ConfirmationEventDto {
    @JvmInline
    value class ConfirmationEventDtoOneOfValue(
        val value: ConfirmationEventDtoOneOf,
    ) : ConfirmationEventDto

    @JvmInline
    value class ConfirmationEventDtoOneOf1Value(
        val value: ConfirmationEventDtoOneOf1,
    ) : ConfirmationEventDto

    @JvmInline
    value class ConfirmationEventDtoOneOf2Value(
        val value: ConfirmationEventDtoOneOf2,
    ) : ConfirmationEventDto

    @JvmInline
    value class ConfirmationEventDtoOneOf3Value(
        val value: ConfirmationEventDtoOneOf3,
    ) : ConfirmationEventDto
}

object ConfirmationEventDtoSerializer : KSerializer<ConfirmationEventDto> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("ConfirmationEventDto")

    override fun serialize(
        encoder: Encoder,
        value: ConfirmationEventDto,
    ) {
        val jsonEncoder = encoder as? JsonEncoder ?: throw SerializationException("ConfirmationEventDto can only be serialized with Json")

        when (value) {
            is ConfirmationEventDto.ConfirmationEventDtoOneOfValue -> {
                jsonEncoder.encodeSerializableValue(
                    ConfirmationEventDtoOneOf.serializer(),
                    value.value,
                )
            }

            is ConfirmationEventDto.ConfirmationEventDtoOneOf1Value -> {
                jsonEncoder.encodeSerializableValue(
                    ConfirmationEventDtoOneOf1.serializer(),
                    value.value,
                )
            }

            is ConfirmationEventDto.ConfirmationEventDtoOneOf2Value -> {
                jsonEncoder.encodeSerializableValue(
                    ConfirmationEventDtoOneOf2.serializer(),
                    value.value,
                )
            }

            is ConfirmationEventDto.ConfirmationEventDtoOneOf3Value -> {
                jsonEncoder.encodeSerializableValue(
                    ConfirmationEventDtoOneOf3.serializer(),
                    value.value,
                )
            }
        }
    }

    override fun deserialize(decoder: Decoder): ConfirmationEventDto {
        val jsonDecoder = decoder as? JsonDecoder ?: throw SerializationException("ConfirmationEventDto can only be deserialized with Json")
        val jsonElement = jsonDecoder.decodeJsonElement()

        val errorMessages = mutableListOf<String>()

        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<ConfirmationEventDtoOneOf>(jsonElement)
                return ConfirmationEventDto.ConfirmationEventDtoOneOfValue(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as ConfirmationEventDtoOneOf: ${e.message}")
            }
        }
        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<ConfirmationEventDtoOneOf1>(jsonElement)
                return ConfirmationEventDto.ConfirmationEventDtoOneOf1Value(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as ConfirmationEventDtoOneOf1: ${e.message}")
            }
        }
        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<ConfirmationEventDtoOneOf2>(jsonElement)
                return ConfirmationEventDto.ConfirmationEventDtoOneOf2Value(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as ConfirmationEventDtoOneOf2: ${e.message}")
            }
        }
        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<ConfirmationEventDtoOneOf3>(jsonElement)
                return ConfirmationEventDto.ConfirmationEventDtoOneOf3Value(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as ConfirmationEventDtoOneOf3: ${e.message}")
            }
        }

        throw SerializationException("Cannot deserialize ConfirmationEventDto. Tried: ${errorMessages.joinToString(", ")}")
    }
}
