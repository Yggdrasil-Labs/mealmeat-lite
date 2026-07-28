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

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ClearPatch
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SetUriPatch
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
@Serializable(with = UpdateRecipeInputPatchImageUrlSerializer::class)
sealed interface UpdateRecipeInputPatchImageUrl {
    @JvmInline
    value class ClearPatchValue(
        val value: ClearPatch,
    ) : UpdateRecipeInputPatchImageUrl

    @JvmInline
    value class SetUriPatchValue(
        val value: SetUriPatch,
    ) : UpdateRecipeInputPatchImageUrl
}

object UpdateRecipeInputPatchImageUrlSerializer : KSerializer<UpdateRecipeInputPatchImageUrl> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("UpdateRecipeInputPatchImageUrl")

    override fun serialize(
        encoder: Encoder,
        value: UpdateRecipeInputPatchImageUrl,
    ) {
        val jsonEncoder =
            encoder as? JsonEncoder ?: throw SerializationException("UpdateRecipeInputPatchImageUrl can only be serialized with Json")

        when (value) {
            is UpdateRecipeInputPatchImageUrl.ClearPatchValue -> jsonEncoder.encodeSerializableValue(ClearPatch.serializer(), value.value)
            is UpdateRecipeInputPatchImageUrl.SetUriPatchValue -> jsonEncoder.encodeSerializableValue(SetUriPatch.serializer(), value.value)
        }
    }

    override fun deserialize(decoder: Decoder): UpdateRecipeInputPatchImageUrl {
        val jsonDecoder =
            decoder as? JsonDecoder ?: throw SerializationException("UpdateRecipeInputPatchImageUrl can only be deserialized with Json")
        val jsonElement = jsonDecoder.decodeJsonElement()

        val errorMessages = mutableListOf<String>()

        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<ClearPatch>(jsonElement)
                return UpdateRecipeInputPatchImageUrl.ClearPatchValue(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as ClearPatch: ${e.message}")
            }
        }
        if (jsonElement !is JsonPrimitive) {
            try {
                val instance = jsonDecoder.json.decodeFromJsonElement<SetUriPatch>(jsonElement)
                return UpdateRecipeInputPatchImageUrl.SetUriPatchValue(instance)
            } catch (e: Exception) {
                errorMessages.add("Failed to deserialize as SetUriPatch: ${e.message}")
            }
        }

        throw SerializationException("Cannot deserialize UpdateRecipeInputPatchImageUrl. Tried: ${errorMessages.joinToString(", ")}")
    }
}
