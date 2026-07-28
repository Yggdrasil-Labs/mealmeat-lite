package io.yggdrasil.labs.mealmate.lite.contract

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

/**
 * 契约 JSON 实例
 *
 * 配置严格解析规则：
 * - ignoreUnknownKeys = false: 拒绝 unknown 字段
 * - isLenient = false: 不接受非标准 JSON
 * - coerceInputValues = false: 不做类型强制转换
 * - explicitNulls = true: 保留显式 null，避免 missing 与 null 语义合并
 */
@OptIn(ExperimentalSerializationApi::class)
val contractJson: Json =
    Json {
        // 严格模式 - 拒绝 unknown 字段
        ignoreUnknownKeys = false

        // 不接受非标准 JSON (如无引号字符串)
        isLenient = false

        // 不做类型强制转换
        coerceInputValues = false

        // 保留 JSON 中显式的 null；optional/missing 仍由模型默认值表达。
        explicitNulls = true

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
