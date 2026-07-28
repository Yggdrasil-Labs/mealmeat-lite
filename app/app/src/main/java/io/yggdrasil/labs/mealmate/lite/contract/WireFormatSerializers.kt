package io.yggdrasil.labs.mealmate.lite.contract

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.modules.SerializersModule
import kotlinx.serialization.modules.contextual
import java.net.URI
import java.net.URISyntaxException
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID

/**
 * UUID Serializer (java.util.UUID)，仅接受小写 canonical form。
 */
object UuidSerializer : KSerializer<UUID> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("java.util.UUID", PrimitiveKind.STRING)

    override fun serialize(
        encoder: Encoder,
        value: UUID,
    ) {
        encoder.encodeString(value.toString())
    }

    override fun deserialize(decoder: Decoder): UUID {
        val value = decoder.decodeString()
        if (!validateUuidFormat(value)) {
            throw SerializationException("UUID must be lowercase canonical form: $value")
        }
        return UUID.fromString(value)
    }
}

/** 仅接受 UTC RFC 3339 时间。 */
object OffsetDateTimeSerializer : KSerializer<OffsetDateTime> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("java.time.OffsetDateTime", PrimitiveKind.STRING)

    override fun serialize(
        encoder: Encoder,
        value: OffsetDateTime,
    ) {
        encoder.encodeString(value.withOffsetSameInstant(ZoneOffset.UTC).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
    }

    override fun deserialize(decoder: Decoder): OffsetDateTime {
        val value = decoder.decodeString()
        val dateTime =
            try {
                OffsetDateTime.parse(value, DateTimeFormatter.ISO_OFFSET_DATE_TIME)
            } catch (error: Exception) {
                throw SerializationException("Invalid RFC 3339 date-time: $value", error)
            }
        if (dateTime.offset != ZoneOffset.UTC) {
            throw SerializationException("DateTime must be UTC (Z suffix): $value")
        }
        return dateTime
    }
}

object LocalDateSerializer : KSerializer<LocalDate> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("java.time.LocalDate", PrimitiveKind.STRING)

    override fun serialize(
        encoder: Encoder,
        value: LocalDate,
    ) {
        encoder.encodeString(value.format(DateTimeFormatter.ISO_LOCAL_DATE))
    }

    override fun deserialize(decoder: Decoder): LocalDate =
        try {
            LocalDate.parse(decoder.decodeString(), DateTimeFormatter.ISO_LOCAL_DATE)
        } catch (error: Exception) {
            throw SerializationException("Invalid ISO local date", error)
        }
}

/**
 * URI serializer keeps the generated OpenAPI type and enforces an absolute URI at the
 * contract boundary. Relative URLs must never silently enter persistence or transport models.
 */
object UriSerializer : KSerializer<URI> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("java.net.URI", PrimitiveKind.STRING)

    override fun serialize(
        encoder: Encoder,
        value: URI,
    ) {
        if (!value.isAbsolute) {
            throw SerializationException("URI must be absolute: $value")
        }
        encoder.encodeString(value.toASCIIString())
    }

    override fun deserialize(decoder: Decoder): URI {
        val value = decoder.decodeString()
        val uri =
            try {
                URI(value)
            } catch (error: URISyntaxException) {
                throw SerializationException("Invalid URI: $value", error)
            }
        if (!uri.isAbsolute) {
            throw SerializationException("URI must be absolute: $value")
        }
        return uri
    }
}

val contractWireFormatSerializers: SerializersModule =
    SerializersModule {
        contextual(UUID::class, UuidSerializer)
        contextual(OffsetDateTime::class, OffsetDateTimeSerializer)
        contextual(LocalDate::class, LocalDateSerializer)
        contextual(URI::class, UriSerializer)
    }
