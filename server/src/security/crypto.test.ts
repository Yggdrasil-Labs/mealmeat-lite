/**
 * 安全原语单元测试 — 家庭码、token、RFC 8785 规范化与签名 cursor
 */
import { describe, expect, it } from 'vitest'
import {
  canonicalizeRfc8785,
  DEVICE_TOKEN_PATTERN,
  decodeSignedCursor,
  deriveHmacKey,
  encodeSignedCursor,
  formatFamilyCode,
  generateFamilyCode,
  hmacSha256,
  normalizeFamilyCode,
  randomDeviceToken,
  sha256Hex,
} from './crypto.js'

const KEY = deriveHmacKey(Buffer.alloc(32, 1), 'test-context')

function acceptAny(_value: unknown): _value is unknown {
  return true
}

function rejectAll(_value: unknown): _value is unknown {
  return false
}

describe('generateFamilyCode', () => {
  it('always emits 12 Crockford characters excluding I/L/O/U', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateFamilyCode()
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/)
      expect(code).not.toMatch(/[ILOU]/)
    }
  })

  it('is uniformly distributed across the alphabet', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 400; i++) seen.add(generateFamilyCode())
    // 400 个 60-bit 样本全部唯一（碰撞概率可忽略）
    expect(seen.size).toBe(400)
  })
})

describe('normalizeFamilyCode', () => {
  it('strips spaces and hyphens, uppercases, and maps O/I/L', () => {
    expect(normalizeFamilyCode('o1l2-3456 7890')).toBe('011234567890')
    expect(normalizeFamilyCode('ABCD-EFGH-JKMN')).toBe('ABCDEFGHJKMN')
    expect(normalizeFamilyCode('abcd efgh jkmn')).toBe('ABCDEFGHJKMN')
  })

  it('rejects wrong lengths and forbidden characters', () => {
    expect(normalizeFamilyCode('ABCD-EFGH')).toBeNull()
    expect(normalizeFamilyCode('ABCDEFGHJKMNU')).toBeNull()
    expect(normalizeFamilyCode('ABCDEFGHJKM!')).toBeNull()
    expect(normalizeFamilyCode('')).toBeNull()
  })

  it('formats with XXXX-XXXX-XXXX display grouping', () => {
    expect(formatFamilyCode('ABCDEFGHJKMN')).toBe('ABCD-EFGH-JKMN')
  })
})

describe('randomDeviceToken', () => {
  it('returns a 43-char base64url token and its SHA-256 hex hash', () => {
    const material = randomDeviceToken()
    expect(material.token).toMatch(DEVICE_TOKEN_PATTERN)
    expect(material.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(sha256Hex(material.token)).toBe(material.tokenHash)
  })
})

describe('canonicalizeRfc8785', () => {
  it('sorts object keys and normalizes integers', () => {
    expect(canonicalizeRfc8785({ b: 2, a: [1, null, true] })).toBe('{"a":[1,null,true],"b":2}')
  })

  it('is deterministic across key insertion order', () => {
    const left = { phase: 'snapshot', watermark: '7', limit: 2 }
    const right = { limit: 2, watermark: '7', phase: 'snapshot' }
    expect(canonicalizeRfc8785(left)).toBe(canonicalizeRfc8785(right))
  })

  it('rejects non-finite numbers', () => {
    expect(() => canonicalizeRfc8785({ x: Number.NaN })).toThrow()
  })
})

describe('signed cursors', () => {
  const payload = { schemaVersion: 1, phase: 'snapshot', watermark: '3', limit: 10 }

  it('round-trips a valid cursor', () => {
    const cursor = encodeSignedCursor(payload, KEY)
    const decoded = decodeSignedCursor(cursor, KEY, acceptAny)
    expect(decoded).toEqual(payload)
  })

  it('rejects a tampered payload', () => {
    const cursor = encodeSignedCursor(payload, KEY)
    const tampered = cursor.replace(
      cursor.split('.')[0] ?? '',
      Buffer.from('{}').toString('base64url'),
    )
    expect(decodeSignedCursor(tampered, KEY, acceptAny)).toBeNull()
  })

  it('rejects a tampered signature', () => {
    const cursor = encodeSignedCursor(payload, KEY)
    const parts = cursor.split('.')
    const encoded = parts[0] ?? ''
    const signature = parts[1] ?? ''
    const flipped =
      signature === '' ? 'AAAA' : (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1)
    expect(decodeSignedCursor(encoded + '.' + flipped, KEY, acceptAny)).toBeNull()
  })

  it('rejects a cursor signed with a different key', () => {
    const otherKey = deriveHmacKey(Buffer.alloc(32, 2), 'test-context')
    const cursor = encodeSignedCursor(payload, KEY)
    expect(decodeSignedCursor(cursor, otherKey, acceptAny)).toBeNull()
  })

  it('rejects malformed cursor strings', () => {
    expect(decodeSignedCursor('', KEY, acceptAny)).toBeNull()
    expect(decodeSignedCursor('no-dot', KEY, acceptAny)).toBeNull()
    expect(decodeSignedCursor('a.b.c', KEY, acceptAny)).toBeNull()
    expect(decodeSignedCursor('###.sig', KEY, acceptAny)).toBeNull()
  })

  it('does not accept payloads failing the validator', () => {
    const cursor = encodeSignedCursor(payload, KEY)
    expect(decodeSignedCursor(cursor, KEY, rejectAll)).toBeNull()
  })
})

describe('hmacSha256', () => {
  it('derives deterministic keys and digests', () => {
    const key = deriveHmacKey(Buffer.alloc(32, 7), 'ctx')
    expect(hmacSha256(key, 'msg').toString('hex')).toHaveLength(64)
    expect(hmacSha256(key, 'msg').toString('hex')).toBe(hmacSha256(key, 'msg').toString('hex'))
    expect(hmacSha256(key, 'msg').toString('hex')).not.toBe(
      hmacSha256(key, 'other').toString('hex'),
    )
  })
})
