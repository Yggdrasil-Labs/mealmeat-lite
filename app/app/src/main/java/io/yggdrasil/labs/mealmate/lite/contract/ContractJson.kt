package io.yggdrasil.labs.mealmate.lite.contract

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.Json
import kotlinx.serialization.modules.SerializersModule
import kotlinx.serialization.modules.contextual
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.UUID

/**
 * UUID Serializer (java.util.UUID)
 *
 * 验证 canonical 小写格式 (8-4-4-4-12)
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
        val string = decoder.decodeString()
        // 验证小写格式
        if (!validateUuidFormat(string)) {
            throw IllegalArgumentException("UUID must be lowercase canonical form: $string")
        }
        return UUID.fromString(string)
    }
}

/**
 * OffsetDateTime Serializer (java.time.OffsetDateTime)
 *
 * 验证 UTC 时区 (Z 后缀)
 */
object OffsetDateTimeSerializer : KSerializer<OffsetDateTime> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("java.time.OffsetDateTime", PrimitiveKind.STRING)

    override fun serialize(
        encoder: Encoder,
        value: OffsetDateTime,
    ) {
        // 总是输出 UTC
        val utc = value.withOffsetSameInstant(ZoneOffset.UTC)
        encoder.encodeString(utc.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
    }

    override fun deserialize(decoder: Decoder): OffsetDateTime {
        val string = decoder.decodeString()
        val dateTime = OffsetDateTime.parse(string, DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        // 验证 UTC
        if (dateTime.offset != ZoneOffset.UTC) {
            throw IllegalArgumentException("DateTime must be UTC (Z suffix): $string")
        }
        return dateTime
    }
}

/**
 * LocalDate Serializer (java.time.LocalDate)
 */
object LocalDateSerializer : KSerializer<LocalDate> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("java.time.LocalDate", PrimitiveKind.STRING)

    override fun serialize(
        encoder: Encoder,
        value: LocalDate,
    ) {
        encoder.encodeString(value.format(DateTimeFormatter.ISO_LOCAL_DATE))
    }

    override fun deserialize(decoder: Decoder): LocalDate {
        val string = decoder.decodeString()
        return LocalDate.parse(string, DateTimeFormatter.ISO_LOCAL_DATE)
    }
}

/**
 * Any Serializer - 用于 OpenAPI Generator 生成的常量字段
 *
 * 这些字段实际上是 const 枚举 (如 "recipe", "upsert")
 * 反序列化时作为 String 处理
 */
object AnySerializer : KSerializer<Any?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("kotlin.Any", PrimitiveKind.STRING)

    override fun serialize(
        encoder: Encoder,
        value: Any?,
    ) {
        when (value) {
            null -> encoder.encodeNull()
            is String -> encoder.encodeString(value)
            is Number -> encoder.encodeString(value.toString())
            is Boolean -> encoder.encodeBoolean(value)
            else -> encoder.encodeString(value.toString())
        }
    }

    override fun deserialize(decoder: Decoder): Any? {
        // 简单作为 String 处理
        return decoder.decodeString()
    }
}

/**
 * 契约 wire format 的自定义 serializers
 */
val contractWireFormatSerializers: SerializersModule =
    SerializersModule {
        contextual(UUID::class, UuidSerializer)
        contextual(OffsetDateTime::class, OffsetDateTimeSerializer)
        contextual(LocalDate::class, LocalDateSerializer)
        // Any 类型不需要注册 contextual，生成的代码使用 @Contextual 标注
        // 但 kotlinx.serialization 不支持对 Any 的 contextual serialization
        // 生成的类中的 Any? 字段实际上是 const string，可以直接忽略
    }

/**
 * 契约 JSON 实例
 *
 * 配置严格解析规则：
 * - ignoreUnknownKeys = false: 拒绝 unknown 字段
 * - isLenient = false: 不接受非标准 JSON
 * - coerceInputValues = false: 不做类型强制转换
 * - explicitNulls = false: null 字段可省略
 */
val contractJson: Json =
    Json {
        // 严格模式 - 拒绝 unknown 字段
        ignoreUnknownKeys = false

        // 不接受非标准 JSON (如无引号字符串)
        isLenient = false

        // 不做类型强制转换
        coerceInputValues = false

        // null 字段可省略 (支持 missing 语义)
        explicitNulls = false

        // 枚举解码失败时不使用默认值
        decodeEnumsCaseInsensitive = false

        // 输出格式
        encodeDefaults = true
        prettyPrint = false

        // 注册自定义 serializers
        serializersModule = contractWireFormatSerializers
    }

// UUID canonical form 正则: 小写 hex + 正确分隔
private val UUID_PATTERN = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

/**
 * 验证 UUID 字符串格式
 *
 * - 只接受小写 canonical form (8-4-4-4-12)
 * - 拒绝大写字母
 */
fun validateUuidFormat(value: String): Boolean = UUID_PATTERN.matches(value)

/**
 * 验证 UTC date-time 格式
 *
 * - 只接受零 offset (Z 后缀)
 */
fun validateUtcDateTimeFormat(value: String): Boolean =
    try {
        val dateTime = OffsetDateTime.parse(value, DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        dateTime.offset == ZoneOffset.UTC
    } catch (e: DateTimeParseException) {
        false
    }

/**
 * 验证绝对 URI 格式
 */
fun validateAbsoluteUriFormat(value: String): Boolean =
    try {
        val uri = java.net.URI.create(value)
        uri.isAbsolute
    } catch (e: IllegalArgumentException) {
        false
    }

/**
 * 带验证的 JSON 解码 - 简单包装器
 */
inline fun <reified T> Json.decodeAndValidate(json: String): T = decodeFromString(json)
