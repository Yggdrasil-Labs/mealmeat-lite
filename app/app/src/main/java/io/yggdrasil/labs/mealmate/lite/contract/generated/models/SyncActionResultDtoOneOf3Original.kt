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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.AppliedResultDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RejectedResultDto
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
@Serializable(with = SyncActionResultDtoOneOf3OriginalSerializer::class)
sealed interface SyncActionResultDtoOneOf3Original {
    @JvmInline
    value class AppliedResultDtoValue(
        val value: AppliedResultDto,
    ) : SyncActionResultDtoOneOf3Original

    @JvmInline
    value class RejectedResultDtoValue(
        val value: RejectedResultDto,
    ) : SyncActionResultDtoOneOf3Original
}

object SyncActionResultDtoOneOf3OriginalSerializer : KSerializer<SyncActionResultDtoOneOf3Original> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("SyncActionResultDtoOneOf3Original")

    override fun serialize(
        encoder: Encoder,
        value: SyncActionResultDtoOneOf3Original,
    ) {
        val jsonEncoder =
            encoder as? JsonEncoder ?: throw SerializationException("SyncActionResultDtoOneOf3Original can only be serialized with Json")

        when (value) {
            is SyncActionResultDtoOneOf3Original.AppliedResultDtoValue -> {
                jsonEncoder.encodeSerializableValue(
                    AppliedResultDto.serializer(),
                    value.value,
                )
            }

            is SyncActionResultDtoOneOf3Original.RejectedResultDtoValue -> {
                jsonEncoder.encodeSerializableValue(
                    RejectedResultDto.serializer(),
                    value.value,
                )
            }
        }
    }

    override fun deserialize(decoder: Decoder): SyncActionResultDtoOneOf3Original {
        val jsonDecoder =
            decoder as? JsonDecoder ?: throw SerializationException("SyncActionResultDtoOneOf3Original can only be deserialized with Json")
        val jsonElement = jsonDecoder.decodeJsonElement()

        val errorMessages = mutableListOf<String>()

        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<AppliedResultDto>(jsonElement)
                return SyncActionResultDtoOneOf3Original.AppliedResultDtoValue(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as AppliedResultDto: ${e.message}")
            }
        }
        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<RejectedResultDto>(jsonElement)
                return SyncActionResultDtoOneOf3Original.RejectedResultDtoValue(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as RejectedResultDto: ${e.message}")
            }
        }

        throw SerializationException("Cannot deserialize SyncActionResultDtoOneOf3Original. Tried: ${errorMessages.joinToString(", ")}")
    }
}
