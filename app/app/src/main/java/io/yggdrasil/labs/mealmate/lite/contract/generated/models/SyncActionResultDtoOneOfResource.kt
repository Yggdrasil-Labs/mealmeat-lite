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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeTombstone
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeView
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
@Serializable(with = SyncActionResultDtoOneOfResourceSerializer::class)
sealed interface SyncActionResultDtoOneOfResource {
    @JvmInline
    value class RecipeViewValue(
        val value: RecipeView,
    ) : SyncActionResultDtoOneOfResource

    @JvmInline
    value class RecipeTombstoneValue(
        val value: RecipeTombstone,
    ) : SyncActionResultDtoOneOfResource
}

object SyncActionResultDtoOneOfResourceSerializer : KSerializer<SyncActionResultDtoOneOfResource> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("SyncActionResultDtoOneOfResource")

    override fun serialize(
        encoder: Encoder,
        value: SyncActionResultDtoOneOfResource,
    ) {
        val jsonEncoder =
            encoder as? JsonEncoder ?: throw SerializationException("SyncActionResultDtoOneOfResource can only be serialized with Json")

        when (value) {
            is SyncActionResultDtoOneOfResource.RecipeViewValue -> {
                jsonEncoder.encodeSerializableValue(RecipeView.serializer(), value.value)
            }

            is SyncActionResultDtoOneOfResource.RecipeTombstoneValue -> {
                jsonEncoder.encodeSerializableValue(
                    RecipeTombstone.serializer(),
                    value.value,
                )
            }
        }
    }

    override fun deserialize(decoder: Decoder): SyncActionResultDtoOneOfResource {
        val jsonDecoder =
            decoder as? JsonDecoder ?: throw SerializationException("SyncActionResultDtoOneOfResource can only be deserialized with Json")
        val jsonElement = jsonDecoder.decodeJsonElement()

        val errorMessages = mutableListOf<String>()

        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<RecipeView>(jsonElement)
                return SyncActionResultDtoOneOfResource.RecipeViewValue(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as RecipeView: ${e.message}")
            }
        }
        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<RecipeTombstone>(jsonElement)
                return SyncActionResultDtoOneOfResource.RecipeTombstoneValue(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as RecipeTombstone: ${e.message}")
            }
        }

        throw SerializationException("Cannot deserialize SyncActionResultDtoOneOfResource. Tried: ${errorMessages.joinToString(", ")}")
    }
}
