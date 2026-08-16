/**
 * 认证服务 — bootstrap/register/token、设备管理与家庭码轮换
 *
 * 不变量：
 * - bootstrap 成功事务同时创建 AuthConfig、首个 DeviceToken 和默认 Settings，
 *   并为 Settings 分配首个可同步版本；任一写入失败则实例仍视为未初始化
 * - register 在事务外执行 Argon2id 校验，签发事务内 SELECT ... FOR UPDATE
 *   锁定 AuthConfig，只有 hash 与 version 仍与已校验快照相同才创建 DeviceToken
 * - 正确凭证在成功提交事务中清除限流计数；错误凭证递增，第 5 次返回 429
 * - 家庭码/device token 明文只在签发响应中返回一次
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import type { AppConfig } from '../../config.js'
import type {
  BootstrapRequest,
  BootstrapResponse,
  DeviceListResponse,
  RegisterRequest,
  RegisterResponse,
} from '../../contracts/generated/schemas.js'
import type { Db } from '../../db/pool.js'
import { unwrapPostgresError } from '../../db/postgres-error.js'
import { authConfig, deviceTokens } from '../../db/schema/auth.js'
import { SYNC_WRITE_ADVISORY_LOCK_KEY } from '../../db/transactions/sync-write.js'
import { PublicError } from '../../errors.js'
import {
  constantTimeEqual,
  deriveHmacKey,
  formatFamilyCode,
  generateFamilyCode,
  HKDF_CONTEXT_SOURCE_KEY,
  hmacSha256,
  normalizeFamilyCode,
  randomDeviceToken,
} from '../../security/crypto.js'
import { argon2Hasher, type PasswordHasher } from '../../security/passwords.js'
import {
  type AuthScope,
  checkThrottle,
  recordThrottleFailure,
  type ThrottleVerdict,
} from './throttle.js'

export interface AuthServiceDeps {
  getConfig(): AppConfig
  getDb(): Db
  hasher?: PasswordHasher
  clock?: () => Date
}

interface RawAuthConfigRow {
  family_code_hash: string
  family_code_version: string
}

const SETTINGS_RESOURCE_ID = 'familyPreference'

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  private get db(): Db {
    return this.deps.getDb()
  }

  private get hasher(): PasswordHasher {
    return this.deps.hasher ?? argon2Hasher
  }

  private get now(): Date {
    return (this.deps.clock ?? (() => new Date()))()
  }

  private sourceKeyHash(scope: AuthScope, source: string | null): string {
    const key = deriveHmacKey(this.deps.getConfig().bootstrapSecret, HKDF_CONTEXT_SOURCE_KEY)
    return hmacSha256(key, `v1:${scope}:${source ?? 'unknown'}`).toString('hex')
  }

  private throwIfLocked(verdict: ThrottleVerdict): void {
    if (verdict.locked) {
      throw new PublicError('RATE_LIMITED', { retryAfterSeconds: verdict.retryAfterSeconds })
    }
  }

  private trimDeviceName(deviceName: string): string {
    const trimmed = deviceName.trim()
    if (trimmed.length === 0) {
      throw new PublicError('BAD_REQUEST', {
        details: [{ field: 'deviceName', reason: 'must not be blank' }],
      })
    }
    return trimmed
  }

  async bootstrap(input: BootstrapRequest, source: string | null): Promise<BootstrapResponse> {
    const deviceName = this.trimDeviceName(input.deviceName)
    const sourceKeyHash = this.sourceKeyHash('bootstrap', source)
    this.throwIfLocked(await checkThrottle(this.db, 'bootstrap', sourceKeyHash, this.now))

    const existing = await this.db
      .select({ singleton: authConfig.singleton })
      .from(authConfig)
      .limit(1)
    if (existing.length > 0) throw new PublicError('ALREADY_INITIALIZED')

    const presented = Buffer.from(input.bootstrapSecret, 'utf8')
    const expected = Buffer.from(this.deps.getConfig().bootstrapSecret, 'utf8')
    if (!constantTimeEqual(presented, expected)) {
      this.throwIfLocked(await recordThrottleFailure(this.db, 'bootstrap', sourceKeyHash, this.now))
      throw new PublicError('INVALID_BOOTSTRAP_SECRET')
    }

    const familyCode = generateFamilyCode()
    const familyCodeHash = await this.hasher.hash(familyCode)
    const material = randomDeviceToken()
    const settingsPayload = { key: SETTINGS_RESOURCE_ID, value: '' }

    let deviceId: string
    try {
      deviceId = await this.db.transaction(async (tx) => {
        await tx.execute(
          sql`delete from auth_attempt_throttles where scope = 'bootstrap' and source_key_hash = ${sourceKeyHash}`,
        )
        await tx.execute(
          sql`insert into auth_config (singleton, family_code_hash, family_code_version, initialized_at, updated_at) values (true, ${familyCodeHash}, 1, now(), now())`,
        )
        // 同步写锁：Settings 是可同步资源，与 sync-write 模块使用同一全局锁与 sequence
        await tx.execute(sql`select pg_advisory_xact_lock(${SYNC_WRITE_ADVISORY_LOCK_KEY})`)
        await tx.execute(sql`select key from settings where key = 'familyPreference' for update`)
        const versionRows = await tx.execute(
          sql`select nextval('sync_server_version_seq') as version`,
        )
        const version = BigInt(
          (versionRows as unknown as Array<{ version: string }>)[0]?.version ?? '0',
        )
        await tx.execute(
          sql`insert into settings (key, value, value_schema_version, server_version, updated_at) values ('familyPreference', ${JSON.stringify(settingsPayload)}::jsonb, 1, ${version}, now())`,
        )
        await tx.execute(
          sql`insert into sync_changes (server_version, resource, resource_id, operation, payload, payload_schema_version, created_at) values (${version}, 'settings', 'familyPreference', 'upsert', ${JSON.stringify(settingsPayload)}::jsonb, 1, now())`,
        )
        const inserted = await tx.execute(
          sql`insert into device_tokens (id, token_hash, device_name, created_at, last_used_at) values (gen_random_uuid(), ${material.tokenHash}, ${deviceName}, now(), now()) returning id`,
        )
        return (inserted as unknown as Array<{ id: string }>)[0]?.id ?? ''
      })
    } catch (err) {
      const postgresError = unwrapPostgresError(err)
      if (postgresError !== null && postgresError.code === '23505') {
        throw new PublicError('ALREADY_INITIALIZED')
      }
      throw err
    }

    return { deviceId, deviceToken: material.token, familyCode: formatFamilyCode(familyCode) }
  }

  async register(input: RegisterRequest, source: string | null): Promise<RegisterResponse> {
    const normalized = normalizeFamilyCode(input.familyCode)
    if (normalized === null) throw new PublicError('INVALID_FAMILY_CODE')
    const deviceName = this.trimDeviceName(input.deviceName)

    const sourceKeyHash = this.sourceKeyHash('register', source)
    this.throwIfLocked(await checkThrottle(this.db, 'register', sourceKeyHash, this.now))

    const snapshot = await this.db.select().from(authConfig).limit(1)
    const current = snapshot[0]
    if (current === undefined) throw new PublicError('NOT_INITIALIZED')

    // 昂贵 Argon2id 校验必须在任何事务（尤其是 AuthConfig 行锁）之外执行
    const verified = await this.hasher.verify(current.familyCodeHash, normalized)
    if (!verified) {
      this.throwIfLocked(await recordThrottleFailure(this.db, 'register', sourceKeyHash, this.now))
      throw new PublicError('INVALID_FAMILY_CODE')
    }

    const material = randomDeviceToken()
    const deviceId = await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`delete from auth_attempt_throttles where scope = 'register' and source_key_hash = ${sourceKeyHash}`,
      )
      const authRows = await tx.execute(
        sql`select family_code_hash, family_code_version from auth_config where singleton = true for update`,
      )
      const authRow = (authRows as unknown as RawAuthConfigRow[])[0]
      if (authRow === undefined) throw new PublicError('NOT_INITIALIZED')
      if (
        authRow.family_code_hash !== current.familyCodeHash ||
        BigInt(authRow.family_code_version) !== current.familyCodeVersion
      ) {
        // 旧码验证与轮换交错：轮换提交后绝不签发 token
        throw new PublicError('INVALID_FAMILY_CODE')
      }
      const inserted = await tx.execute(
        sql`insert into device_tokens (id, token_hash, device_name, created_at, last_used_at) values (gen_random_uuid(), ${material.tokenHash}, ${deviceName}, now(), now()) returning id`,
      )
      return (inserted as unknown as Array<{ id: string }>)[0]?.id ?? ''
    })

    return { deviceId, deviceToken: material.token }
  }

  async rotateFamilyCode(): Promise<string> {
    const familyCode = generateFamilyCode()
    const familyCodeHash = await this.hasher.hash(familyCode)
    await this.db.transaction(async (tx) => {
      const rows = await tx.execute(
        sql`select family_code_version from auth_config where singleton = true for update`,
      )
      const row = (rows as unknown as Array<{ family_code_version: string }>)[0]
      if (row === undefined) throw new PublicError('NOT_INITIALIZED')
      await tx.execute(
        sql`update auth_config set family_code_hash = ${familyCodeHash}, family_code_version = family_code_version + 1, updated_at = now() where singleton = true`,
      )
    })
    return formatFamilyCode(familyCode)
  }

  async logout(deviceId: string): Promise<{ revoked: true }> {
    await this.db
      .update(deviceTokens)
      .set({ revokedAt: this.now })
      .where(and(eq(deviceTokens.id, deviceId), isNull(deviceTokens.revokedAt)))
    return { revoked: true }
  }

  async listDevices(currentDeviceId: string): Promise<DeviceListResponse> {
    const rows = await this.db
      .select()
      .from(deviceTokens)
      .where(isNull(deviceTokens.revokedAt))
      .orderBy(asc(deviceTokens.createdAt))
    return {
      items: rows.map((row) => ({
        id: row.id,
        deviceName: row.deviceName,
        createdAt: row.createdAt.toISOString(),
        lastUsedAt: row.lastUsedAt.toISOString(),
        isCurrent: row.id === currentDeviceId,
      })),
    }
  }

  async revokeDevice(targetId: string): Promise<{ id: string; revoked: true }> {
    const rows = await this.db
      .update(deviceTokens)
      .set({ revokedAt: this.now })
      .where(and(eq(deviceTokens.id, targetId), isNull(deviceTokens.revokedAt)))
      .returning({ id: deviceTokens.id })
    if (rows[0] === undefined) throw new PublicError('DEVICE_NOT_FOUND')
    return { id: targetId, revoked: true }
  }
}
