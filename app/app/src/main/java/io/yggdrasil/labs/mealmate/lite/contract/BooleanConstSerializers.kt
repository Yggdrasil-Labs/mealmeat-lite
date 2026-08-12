package io.yggdrasil.labs.mealmate.lite.contract

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

/** Enforces a JSON Schema `const: true` field at the Kotlin wire boundary. */
object BooleanConstTrueSerializer : KSerializer<Boolean> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("BooleanConstTrue", PrimitiveKind.BOOLEAN)

    override fun serialize(
        encoder: Encoder,
        value: Boolean,
    ) {
        if (!value) throw SerializationException("Expected boolean const true")
        encoder.encodeBoolean(true)
    }

    override fun deserialize(decoder: Decoder): Boolean {
        if (!decoder.decodeBoolean()) throw SerializationException("Expected boolean const true")
        return true
    }
}

/** Enforces a JSON Schema `const: false` field at the Kotlin wire boundary. */
object BooleanConstFalseSerializer : KSerializer<Boolean> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("BooleanConstFalse", PrimitiveKind.BOOLEAN)

    override fun serialize(
        encoder: Encoder,
        value: Boolean,
    ) {
        if (value) throw SerializationException("Expected boolean const false")
        encoder.encodeBoolean(false)
    }

    override fun deserialize(decoder: Decoder): Boolean {
        if (decoder.decodeBoolean()) throw SerializationException("Expected boolean const false")
        return false
    }
}
