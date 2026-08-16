/**
 * Argon2id 封装 — 家庭码的慢哈希与常量时间验证
 *
 * 参数固定为 memory 64 MiB、iterations 3、parallelism 1、16-byte salt、32-byte output，
 * 输出为 PHC 字符串，与 auth_config.family_code_hash 的数据库 CHECK 一致。
 * 高熵 token 不使用慢 KDF；只有家庭码使用 Argon2id。
 */
import { Algorithm, hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2'

export interface PasswordHasher {
  hash(secret: string): Promise<string>
  verify(phc: string, secret: string): Promise<boolean>
}

export const ARGON2ID_MEMORY_COST = 65536
export const ARGON2ID_TIME_COST = 3
export const ARGON2ID_PARALLELISM = 1

/** 生产实现；测试通过注入替身控制 Argon2 开销与并发屏障。 */
export const argon2Hasher: PasswordHasher = {
  async hash(secret: string): Promise<string> {
    return argon2Hash(secret, {
      algorithm: Algorithm.Argon2id,
      memoryCost: ARGON2ID_MEMORY_COST,
      timeCost: ARGON2ID_TIME_COST,
      parallelism: ARGON2ID_PARALLELISM,
    })
  },
  async verify(phc: string, secret: string): Promise<boolean> {
    if (!phc.startsWith('$argon2id$')) return false
    try {
      return await argon2Verify(phc, secret)
    } catch {
      return false
    }
  },
}
