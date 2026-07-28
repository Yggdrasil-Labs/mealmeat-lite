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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ConfirmationCommitResultDtoOneOf
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ConfirmationCommitResultDtoOneOf1
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.WeeklyPlanUpsertChangeDto
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
@Serializable(with = ConfirmationCommitResultDtoSerializer::class)
sealed interface ConfirmationCommitResultDto {
    @JvmInline
    value class ConfirmationCommitResultDtoOneOfValue(
        val value: ConfirmationCommitResultDtoOneOf,
    ) : ConfirmationCommitResultDto

    @JvmInline
    value class ConfirmationCommitResultDtoOneOf1Value(
        val value: ConfirmationCommitResultDtoOneOf1,
    ) : ConfirmationCommitResultDto
}

object ConfirmationCommitResultDtoSerializer : KSerializer<ConfirmationCommitResultDto> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("ConfirmationCommitResultDto")

    override fun serialize(
        encoder: Encoder,
        value: ConfirmationCommitResultDto,
    ) {
        val jsonEncoder =
            encoder as? JsonEncoder ?: throw SerializationException("ConfirmationCommitResultDto can only be serialized with Json")

        when (value) {
            is ConfirmationCommitResultDto.ConfirmationCommitResultDtoOneOfValue -> {
                jsonEncoder.encodeSerializableValue(
                    ConfirmationCommitResultDtoOneOf.serializer(),
                    value.value,
                )
            }

            is ConfirmationCommitResultDto.ConfirmationCommitResultDtoOneOf1Value -> {
                jsonEncoder.encodeSerializableValue(
                    ConfirmationCommitResultDtoOneOf1.serializer(),
                    value.value,
                )
            }
        }
    }

    override fun deserialize(decoder: Decoder): ConfirmationCommitResultDto {
        val jsonDecoder =
            decoder as? JsonDecoder ?: throw SerializationException("ConfirmationCommitResultDto can only be deserialized with Json")
        val jsonElement = jsonDecoder.decodeJsonElement()

        val errorMessages = mutableListOf<String>()

        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<ConfirmationCommitResultDtoOneOf>(jsonElement)
                return ConfirmationCommitResultDto.ConfirmationCommitResultDtoOneOfValue(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as ConfirmationCommitResultDtoOneOf: ${e.message}")
            }
        }
        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<ConfirmationCommitResultDtoOneOf1>(jsonElement)
                return ConfirmationCommitResultDto.ConfirmationCommitResultDtoOneOf1Value(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as ConfirmationCommitResultDtoOneOf1: ${e.message}")
            }
        }

        throw SerializationException("Cannot deserialize ConfirmationCommitResultDto. Tried: ${errorMessages.joinToString(", ")}")
    }
}
