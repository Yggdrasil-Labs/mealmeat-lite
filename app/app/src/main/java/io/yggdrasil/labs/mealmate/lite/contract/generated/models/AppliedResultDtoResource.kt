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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeTombstone
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeView

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
@Serializable(with = AppliedResultDtoResourceSerializer::class)
sealed interface AppliedResultDtoResource {
    @JvmInline
    value class RecipeViewValue(val value: RecipeView) : AppliedResultDtoResource

    @JvmInline
    value class RecipeTombstoneValue(val value: RecipeTombstone) : AppliedResultDtoResource

}

object AppliedResultDtoResourceSerializer : KSerializer<AppliedResultDtoResource> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("AppliedResultDtoResource")

    override fun serialize(encoder: Encoder, value: AppliedResultDtoResource) {
        val jsonEncoder = encoder as? JsonEncoder ?: throw SerializationException("AppliedResultDtoResource can only be serialized with Json")

        when (value) {
            is AppliedResultDtoResource.RecipeViewValue -> jsonEncoder.encodeSerializableValue(RecipeView.serializer(), value.value)
            is AppliedResultDtoResource.RecipeTombstoneValue -> jsonEncoder.encodeSerializableValue(RecipeTombstone.serializer(), value.value)
        }
    }

    override fun deserialize(decoder: Decoder): AppliedResultDtoResource {
        val jsonDecoder = decoder as? JsonDecoder ?: throw SerializationException("AppliedResultDtoResource can only be deserialized with Json")
        val jsonElement = jsonDecoder.decodeJsonElement()

        val errorMessages = mutableListOf<String>()

        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<RecipeView>(jsonElement)
                return AppliedResultDtoResource.RecipeViewValue(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as RecipeView: ${e.message}")
            }
        }
        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<RecipeTombstone>(jsonElement)
                return AppliedResultDtoResource.RecipeTombstoneValue(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as RecipeTombstone: ${e.message}")
            }
        }

        throw SerializationException("Cannot deserialize AppliedResultDtoResource. Tried: ${errorMessages.joinToString(", ")}")
    }
}
