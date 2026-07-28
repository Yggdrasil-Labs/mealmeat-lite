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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SettingsDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDtoOneOf
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDtoOneOf1
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDtoOneOf2
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDtoOneOf3
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
@Serializable(with = SyncChangeDtoSerializer::class)
sealed interface SyncChangeDto {
    @JvmInline
    value class SyncChangeDtoOneOfValue(
        val value: SyncChangeDtoOneOf,
    ) : SyncChangeDto

    @JvmInline
    value class SyncChangeDtoOneOf1Value(
        val value: SyncChangeDtoOneOf1,
    ) : SyncChangeDto

    @JvmInline
    value class SyncChangeDtoOneOf2Value(
        val value: SyncChangeDtoOneOf2,
    ) : SyncChangeDto

    @JvmInline
    value class SyncChangeDtoOneOf3Value(
        val value: SyncChangeDtoOneOf3,
    ) : SyncChangeDto
}

object SyncChangeDtoSerializer : KSerializer<SyncChangeDto> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("SyncChangeDto")

    override fun serialize(
        encoder: Encoder,
        value: SyncChangeDto,
    ) {
        val jsonEncoder = encoder as? JsonEncoder ?: throw SerializationException("SyncChangeDto can only be serialized with Json")

        when (value) {
            is SyncChangeDto.SyncChangeDtoOneOfValue -> jsonEncoder.encodeSerializableValue(SyncChangeDtoOneOf.serializer(), value.value)
            is SyncChangeDto.SyncChangeDtoOneOf1Value -> jsonEncoder.encodeSerializableValue(SyncChangeDtoOneOf1.serializer(), value.value)
            is SyncChangeDto.SyncChangeDtoOneOf2Value -> jsonEncoder.encodeSerializableValue(SyncChangeDtoOneOf2.serializer(), value.value)
            is SyncChangeDto.SyncChangeDtoOneOf3Value -> jsonEncoder.encodeSerializableValue(SyncChangeDtoOneOf3.serializer(), value.value)
        }
    }

    override fun deserialize(decoder: Decoder): SyncChangeDto {
        val jsonDecoder = decoder as? JsonDecoder ?: throw SerializationException("SyncChangeDto can only be deserialized with Json")
        val jsonElement = jsonDecoder.decodeJsonElement()

        val errorMessages = mutableListOf<String>()

        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<SyncChangeDtoOneOf>(jsonElement)
                return SyncChangeDto.SyncChangeDtoOneOfValue(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as SyncChangeDtoOneOf: ${e.message}")
            }
        }
        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<SyncChangeDtoOneOf1>(jsonElement)
                return SyncChangeDto.SyncChangeDtoOneOf1Value(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as SyncChangeDtoOneOf1: ${e.message}")
            }
        }
        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<SyncChangeDtoOneOf2>(jsonElement)
                return SyncChangeDto.SyncChangeDtoOneOf2Value(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as SyncChangeDtoOneOf2: ${e.message}")
            }
        }
        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<SyncChangeDtoOneOf3>(jsonElement)
                return SyncChangeDto.SyncChangeDtoOneOf3Value(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as SyncChangeDtoOneOf3: ${e.message}")
            }
        }

        throw SerializationException("Cannot deserialize SyncChangeDto. Tried: ${errorMessages.joinToString(", ")}")
    }
}
