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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionResultDtoOneOf
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionResultDtoOneOf1
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionResultDtoOneOf2
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionResultDtoOneOf3
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionResultDtoOneOf3Original
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionResultDtoOneOfResource
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
@Serializable(with = SyncActionResultDtoSerializer::class)
sealed interface SyncActionResultDto {
    @JvmInline
    value class SyncActionResultDtoOneOfValue(
        val value: SyncActionResultDtoOneOf,
    ) : SyncActionResultDto

    @JvmInline
    value class SyncActionResultDtoOneOf1Value(
        val value: SyncActionResultDtoOneOf1,
    ) : SyncActionResultDto

    @JvmInline
    value class SyncActionResultDtoOneOf2Value(
        val value: SyncActionResultDtoOneOf2,
    ) : SyncActionResultDto

    @JvmInline
    value class SyncActionResultDtoOneOf3Value(
        val value: SyncActionResultDtoOneOf3,
    ) : SyncActionResultDto
}

object SyncActionResultDtoSerializer : KSerializer<SyncActionResultDto> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("SyncActionResultDto")

    override fun serialize(
        encoder: Encoder,
        value: SyncActionResultDto,
    ) {
        val jsonEncoder = encoder as? JsonEncoder ?: throw SerializationException("SyncActionResultDto can only be serialized with Json")

        when (value) {
            is SyncActionResultDto.SyncActionResultDtoOneOfValue -> {
                jsonEncoder.encodeSerializableValue(
                    SyncActionResultDtoOneOf.serializer(),
                    value.value,
                )
            }

            is SyncActionResultDto.SyncActionResultDtoOneOf1Value -> {
                jsonEncoder.encodeSerializableValue(
                    SyncActionResultDtoOneOf1.serializer(),
                    value.value,
                )
            }

            is SyncActionResultDto.SyncActionResultDtoOneOf2Value -> {
                jsonEncoder.encodeSerializableValue(
                    SyncActionResultDtoOneOf2.serializer(),
                    value.value,
                )
            }

            is SyncActionResultDto.SyncActionResultDtoOneOf3Value -> {
                jsonEncoder.encodeSerializableValue(
                    SyncActionResultDtoOneOf3.serializer(),
                    value.value,
                )
            }
        }
    }

    override fun deserialize(decoder: Decoder): SyncActionResultDto {
        val jsonDecoder = decoder as? JsonDecoder ?: throw SerializationException("SyncActionResultDto can only be deserialized with Json")
        val jsonElement = jsonDecoder.decodeJsonElement()

        val errorMessages = mutableListOf<String>()

        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<SyncActionResultDtoOneOf>(jsonElement)
                return SyncActionResultDto.SyncActionResultDtoOneOfValue(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as SyncActionResultDtoOneOf: ${e.message}")
            }
        }
        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<SyncActionResultDtoOneOf1>(jsonElement)
                return SyncActionResultDto.SyncActionResultDtoOneOf1Value(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as SyncActionResultDtoOneOf1: ${e.message}")
            }
        }
        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<SyncActionResultDtoOneOf2>(jsonElement)
                return SyncActionResultDto.SyncActionResultDtoOneOf2Value(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as SyncActionResultDtoOneOf2: ${e.message}")
            }
        }
        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<SyncActionResultDtoOneOf3>(jsonElement)
                return SyncActionResultDto.SyncActionResultDtoOneOf3Value(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as SyncActionResultDtoOneOf3: ${e.message}")
            }
        }

        throw SerializationException("Cannot deserialize SyncActionResultDto. Tried: ${errorMessages.joinToString(", ")}")
    }
}
