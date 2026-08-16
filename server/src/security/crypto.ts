/**
 * 安全原语 — HKDF/HMAC/SHA-256、Crockford 家庭码、device token 与 RFC 8785 签名 cursor
 *
 * 所有 HMAC key 都从部署期 bootstrap secret 经 HKDF-SHA256 以独立 context 派生，
 * 与确认令牌（阶段 3）、限流来源键等其它用途隔离。
 * context 字符串是服务端实现细节，不进入任何 wire 响应。
 */
import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto'

export const HKDF_CONTEXT_SOURCE_KEY = 'mealmate/v1/auth-source-key'
export const HKDF_CONTEXT_SYNC_CURSOR = 'mealmate/v1/sync-cursor'

/** Crockford Base32 字母表（排除 I/L/O/U）。 */
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** 32-byte 随机值经 base64url 无 padding 编码后的固定长度。 */
const DEVICE_TOKEN_LENGTH = 43

export function deriveHmacKey(secret: string | Uint8Array, context: string): Buffer {
  const ikm = typeof secret === 'string' ? Buffer.from(secret, 'utf8') : secret
  return Buffer.from(hkdfSync('sha256', ikm, Buffer.alloc(0), context, 32))
}

export function hmacSha256(key: Uint8Array, message: string | Buffer): Buffer {
  return createHmac('sha256', key).update(message).digest()
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

export function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export interface DeviceTokenMaterial {
  /** 明文 token，仅在签发响应中返回一次。 */
  token: string
  /** token 的 SHA-256 十六进制值，唯一持久化形态。 */
  tokenHash: string
}

export function randomDeviceToken(): DeviceTokenMaterial {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: sha256Hex(token) }
}

/** 生成的 device token 必须满足的传输格式（43 字符 base64url 无 padding）。 */
export const DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
export { DEVICE_TOKEN_LENGTH }

/**
 * 生成 12 位 Crockford Base32 家庭码（60 bit）。
 * 每个随机字节对 32 取模，256 % 32 === 0，因此分布均匀。
 */
export function generateFamilyCode(): string {
  const bytes = randomBytes(12)
  let code = ''
  for (const byte of bytes) code += CROCKFORD_ALPHABET[byte % 32]
  return code
}

/**
 * 规范化家庭码输入：去除 ASCII 空格与连字符、转大写、兼容 O→0、I/L→1。
 * 规范化后必须恰好是 12 位 Crockford 字符，否则返回 null。
 */
export function normalizeFamilyCode(input: string): string | null {
  const mapped = input.replace(/[\s-]/g, '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1')
  if (!/^[0-9A-HJKMNP-TV-Z]{12}$/.test(mapped)) return null
  return mapped
}

/** 家庭码展示格式 XXXX-XXXX-XXXX。 */
export function formatFamilyCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`
}

/**
 * RFC 8785 JCS 最小实现 — 仅覆盖本服务的 closed-union payload
 * （object/array/string/boolean/null/整数），对象键按 UTF-16 code unit 升序。
 */
export function canonicalizeRfc8785(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonicalizeRfc8785: non-finite number')
    return Object.is(value, -0) ? '0' : String(value)
  }
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeRfc8785(item)).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalizeRfc8785(record[key])}`).join(',')}}`
  }
  throw new TypeError(`canonicalizeRfc8785: unsupported value type ${typeof value}`)
}

/** 对 UTF-8 字节串做 HMAC-SHA256（cursor/回执 payload 哈希的统一入口）。 */
export function hmacSha256Hex(key: Uint8Array, message: string): string {
  return hmacSha256(key, message).toString('hex')
}

/** 传输格式 <payload>.<signature>，两者均为无 padding base64url。 */
export function encodeSignedCursor(payload: unknown, key: Uint8Array): string {
  const canonical = canonicalizeRfc8785(payload)
  const encoded = Buffer.from(canonical, 'utf8').toString('base64url')
  const signature = hmacSha256(key, canonical).toString('base64url')
  return `${encoded}.${signature}`
}

/**
 * 校验签名并解码 cursor payload；任何篡改（payload/签名/字段）都返回 null。
 * 签名基于解码后重新规范化的 canonical 字符串，杜绝二次编码差异。
 */
export function decodeSignedCursor<T>(
  cursor: string,
  key: Uint8Array,
  validate: (value: unknown) => value is T,
): T | null {
  const dot = cursor.indexOf('.')
  if (dot <= 0) return null
  const encoded = cursor.slice(0, dot)
  const signature = cursor.slice(dot + 1)
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]+$/.test(signature)) return null

  let canonical: string
  try {
    canonical = Buffer.from(encoded, 'base64url').toString('utf8')
  } catch {
    return null
  }
  const expected = hmacSha256(key, canonical).toString('base64url')
  if (!constantTimeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'))) {
    return null
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(canonical)
  } catch {
    return null
  }
  return validate(decoded) ? decoded : null
}
