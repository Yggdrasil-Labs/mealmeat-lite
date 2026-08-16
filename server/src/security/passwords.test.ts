/**
 * Argon2id 封装测试 — PHC 格式与往返验证
 */
import { describe, expect, it } from 'vitest'
import { argon2Hasher } from './passwords.js'

const PHC_PATTERN =
  /^\$argon2id\$v=19\$m=65536,t=3,p=1\$[A-Za-z0-9+/]+={0,2}\$[A-Za-z0-9+/]+={0,2}$/

describe('argon2Hasher', () => {
  it('produces a PHC string matching the database CHECK format', async () => {
    const phc = await argon2Hasher.hash('ABCDEFGHJKMN')
    expect(phc).toMatch(PHC_PATTERN)
    expect(phc).toContain('$argon2id$v=19$m=65536,t=3,p=1$')
  })

  it('verifies the matching secret and rejects others', async () => {
    const phc = await argon2Hasher.hash('ABCDEFGHJKMN')
    await expect(argon2Hasher.verify(phc, 'ABCDEFGHJKMN')).resolves.toBe(true)
    await expect(argon2Hasher.verify(phc, '000000000000')).resolves.toBe(false)
  })

  it('rejects non-argon2id hashes without throwing', async () => {
    await expect(argon2Hasher.verify('not-a-phc-string', 'x')).resolves.toBe(false)
  })
})
