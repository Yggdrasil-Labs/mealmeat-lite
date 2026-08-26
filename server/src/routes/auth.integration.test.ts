import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { deriveHmacKey, HKDF_CONTEXT_SOURCE_KEY, hmacSha256 } from '../security/crypto.js'
import { argon2Hasher } from '../security/passwords.js'
import {
  authedDelete,
  authedGet,
  authedPost,
  bootstrapDevice,
  type EnvelopeBody,
  makeTestApp,
  startTestPostgres,
  TEST_BOOTSTRAP_SECRET,
  type TestPostgres,
} from '../test-support/pg.js'

const WRONG_SECRET = 'ab'.repeat(32)

interface AuthResult {
  deviceId: string
  deviceToken: string
  familyCode: string
}

/** 与服务端一致地重算限流行键，用于直查 auth_attempt_throttles。 */
function sourceKeyHashFor(scope: 'bootstrap' | 'register', source: string): string {
  const key = deriveHmacKey(TEST_BOOTSTRAP_SECRET, HKDF_CONTEXT_SOURCE_KEY)
  return hmacSha256(key, 'v1:' + scope + ':' + source).toString('hex')
}

function registerRequest(
  app: ReturnType<typeof makeTestApp>,
  familyCode: string,
  deviceName: string,
) {
  return app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familyCode, deviceName }),
  })
}

describe('bootstrap（未初始化实例）', () => {
  let pg: TestPostgres

  beforeAll(async () => {
    pg = await startTestPostgres()
  })

  afterAll(async () => {
    await pg.stop()
  })

  function bootstrapAttempt(app: ReturnType<typeof makeTestApp>, secret: string, deviceName = 'd') {
    return app.request('/api/v1/auth/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bootstrapSecret: secret, deviceName }),
    })
  }

  it('错误 secret → 401 INVALID_BOOTSTRAP_SECRET envelope，无 Retry-After', async () => {
    const app = makeTestApp(pg, { source: '203.0.113.10' })
    const res = await bootstrapAttempt(app, WRONG_SECRET)
    expect(res.status).toBe(401)
    const body = (await res.json()) as EnvelopeBody<unknown>
    expect(body.success).toBe(false)
    expect(body.errCode).toBe('INVALID_BOOTSTRAP_SECRET')
    expect(body.retryable).toBe(false)
    expect(body.requestId).toBeTruthy()
    expect(res.headers.get('Retry-After')).toBeNull()
  })

  it('第 5 次连续失败 → 429 RATE_LIMITED 且 Retry-After 在 1..900', async () => {
    const app = makeTestApp(pg, { source: '203.0.113.11' })
    for (let i = 0; i < 4; i++) {
      expect((await bootstrapAttempt(app, WRONG_SECRET)).status).toBe(401)
    }
    const fifth = await bootstrapAttempt(app, WRONG_SECRET)
    expect(fifth.status).toBe(429)
    const body = (await fifth.json()) as EnvelopeBody<unknown>
    expect(body.errCode).toBe('RATE_LIMITED')
    expect(body.retryable).toBe(true)
    const retryAfter = Number(fifth.headers.get('Retry-After'))
    expect(Number.isInteger(retryAfter)).toBe(true)
    expect(retryAfter).toBeGreaterThanOrEqual(1)
    expect(retryAfter).toBeLessThanOrEqual(900)
  })

  it('锁定期内正确 secret 直接 429 不初始化；到期重开周期后成功清零', async () => {
    let fakeNow = new Date('2026-07-01T00:00:00Z')
    const app = makeTestApp(pg, { source: '203.0.113.12', clock: () => fakeNow })
    for (let i = 0; i < 5; i++) await bootstrapAttempt(app, WRONG_SECRET)
    // 锁定期内：不校验 secret 也不初始化
    const locked = await bootstrapAttempt(app, TEST_BOOTSTRAP_SECRET, 'real')
    expect(locked.status).toBe(429)
    const before = await pg.sql.unsafe('select count(*)::text as count from auth_config')
    expect(before[0]?.count).toBe('0')
    // 15 分钟到期后的首次尝试重置计数并正常校验
    fakeNow = new Date(fakeNow.getTime() + 16 * 60_000)
    const success = await bootstrapAttempt(app, TEST_BOOTSTRAP_SECRET, 'real')
    expect(success.status).toBe(200)
    const body = (await success.json()) as { success: boolean; data: AuthResult }
    expect(body.success).toBe(true)
    expect(body.data.deviceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(body.data.deviceToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(body.data.familyCode).toMatch(
      /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
    )
  })

  it('bootstrap 成功事务原子创建 AuthConfig、首个设备、默认 Settings 与首个同步版本', async () => {
    const rows = await pg.sql.unsafe(
      'select (select count(*)::text from auth_config) as auth_configs, ' +
        '(select count(*)::text from device_tokens) as devices, ' +
        '(select count(*)::text from settings) as settings_count, ' +
        '(select count(*)::text from sync_changes) as changes, ' +
        "(select value ->> 'key' from settings where key = 'familyPreference') as pref_key, " +
        "(select value ->> 'value' from settings where key = 'familyPreference') as pref_value",
    )
    expect(rows[0]).toEqual({
      auth_configs: '1',
      devices: '1',
      settings_count: '1',
      changes: '1',
      pref_key: 'familyPreference',
      pref_value: '',
    })
    const changes = await pg.sql.unsafe(
      'select server_version, resource, operation from sync_changes',
    )
    expect(changes[0]).toMatchObject({
      server_version: '1',
      resource: 'settings',
      operation: 'upsert',
    })
  })

  it('再次 bootstrap → 409 ALREADY_INITIALIZED', async () => {
    const app = makeTestApp(pg, { source: '203.0.113.13' })
    const res = await bootstrapAttempt(app, TEST_BOOTSTRAP_SECRET, 'second')
    expect(res.status).toBe(409)
    const body = (await res.json()) as EnvelopeBody<unknown>
    expect(body.errCode).toBe('ALREADY_INITIALIZED')
  })
})

describe('register 与设备管理（已初始化实例）', () => {
  let pg: TestPostgres
  let app: ReturnType<typeof makeTestApp>
  let first: AuthResult
  let currentFamilyCode = ''

  beforeAll(async () => {
    pg = await startTestPostgres()
    app = makeTestApp(pg, { source: '203.0.113.20' })
  })

  afterAll(async () => {
    await pg.stop()
  })

  it('未初始化时 register → 409 NOT_INITIALIZED', async () => {
    const res = await registerRequest(app, 'ABCD-EFGH-JKMN', 'd2')
    expect(res.status).toBe(409)
    const body = (await res.json()) as EnvelopeBody<unknown>
    expect(body.errCode).toBe('NOT_INITIALIZED')
  })

  it('bootstrap 后：错误/格式非法家庭码 → 401 INVALID_FAMILY_CODE', async () => {
    first = await bootstrapDevice(app)
    currentFamilyCode = first.familyCode
    const wrong = await registerRequest(app, '1111-1111-1111', 'd2')
    expect(wrong.status).toBe(401)
    expect(((await wrong.json()) as EnvelopeBody<unknown>).errCode).toBe('INVALID_FAMILY_CODE')
    const malformed = await registerRequest(app, 'too-short', 'd2')
    expect(malformed.status).toBe(401)
  })

  it('正确家庭码 → 200，token 可访问受保护路由', async () => {
    const res = await registerRequest(app, currentFamilyCode, 'second-device')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; data: { deviceToken: string } }
    expect(body.success).toBe(true)
    expect(body.data.deviceToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const devices = await authedGet(app, '/api/v1/auth/devices', body.data.deviceToken)
    expect(devices.status).toBe(200)
  })

  it('register 第 5 次连续失败 → 429 RATE_LIMITED 且带 Retry-After', async () => {
    const throttled = makeTestApp(pg, { source: '203.0.113.21' })
    for (let i = 0; i < 4; i++) {
      expect((await registerRequest(throttled, '2222-2222-2222', 'x')).status).toBe(401)
    }
    const fifth = await registerRequest(throttled, '2222-2222-2222', 'x')
    expect(fifth.status).toBe(429)
    expect(((await fifth.json()) as EnvelopeBody<unknown>).errCode).toBe('RATE_LIMITED')
    const retryAfter = Number(fifth.headers.get('Retry-After'))
    expect(retryAfter).toBeGreaterThanOrEqual(1)
    expect(retryAfter).toBeLessThanOrEqual(900)
  })

  it('成功凭证在同事务清零计数：清零后重新从第 1 次计起', async () => {
    const source = '203.0.113.23'
    const app = makeTestApp(pg, { source })
    const sourceHash = sourceKeyHashFor('register', source)
    // 先失败 2 次，再成功 1 次
    for (let i = 0; i < 2; i++) {
      expect((await registerRequest(app, '2222-2222-2222', 'x')).status).toBe(401)
    }
    const success = await registerRequest(app, currentFamilyCode, 'clear-check-device')
    expect(success.status).toBe(200)
    // 成功事务已删除限流行
    const cleared = await pg.sql.unsafe(
      'select count(*)::text as count from auth_attempt_throttles where scope = $1 and source_key_hash = $2',
      ['register', sourceHash],
    )
    expect(cleared[0]?.count).toBe('0')
    // 重新失败：前 4 次 401，第 5 次才 429
    for (let i = 0; i < 4; i++) {
      expect((await registerRequest(app, '2222-2222-2222', 'x')).status).toBe(401)
    }
    expect((await registerRequest(app, '2222-2222-2222', 'x')).status).toBe(429)
  })

  it('锁定跨进程实例保留（重启不清零）：新实例仍 429', async () => {
    const source = '203.0.113.24'
    const app = makeTestApp(pg, { source })
    for (let i = 0; i < 5; i++) await registerRequest(app, '2222-2222-2222', 'x')
    // 新 app 实例 = 新进程语义（服务无内存态，计数在 PostgreSQL）
    const restarted = makeTestApp(pg, { source })
    const res = await registerRequest(restarted, currentFamilyCode, 'after-restart')
    expect(res.status).toBe(429)
    expect(((await res.json()) as EnvelopeBody<unknown>).errCode).toBe('RATE_LIMITED')
    const retryAfter = Number(res.headers.get('Retry-After'))
    expect(retryAfter).toBeGreaterThanOrEqual(1)
    expect(retryAfter).toBeLessThanOrEqual(900)
  })

  it('并发失败请求不能绕过第 5 次阈值', async () => {
    const source = '203.0.113.25'
    const app = makeTestApp(pg, { source })
    const sourceHash = sourceKeyHashFor('register', source)
    // 6 个并发失败请求同时到达：行锁串行化，恰在第 5 次锁定，此后一律 429
    const results = await Promise.all(
      Array.from({ length: 6 }, () => registerRequest(app, '2222-2222-2222', 'x')),
    )
    expect(results.some((res) => res.status === 429)).toBe(true)
    const row = await pg.sql.unsafe(
      'select failure_count::text, locked_until is not null as locked from auth_attempt_throttles where scope = $1 and source_key_hash = $2',
      ['register', sourceHash],
    )
    // 并发下计数可略超 5（已在途请求各自递增），关键不变量是锁已生效且不再放行
    expect(row[0]?.locked).toBe(true)
    expect(Number(row[0]?.failure_count)).toBeGreaterThanOrEqual(5)
    // 锁定期内即使正确凭证也不放行
    const lockedRes = await registerRequest(app, currentFamilyCode, 'concurrent-racer')
    expect(lockedRes.status).toBe(429)
  })

  it('轮换：旧码立即失效、新码可注册；未鉴权轮换 → 401', async () => {
    const unauth = await app.request('/api/v1/auth/family-code/rotate', { method: 'POST' })
    expect(unauth.status).toBe(401)
    const rotate = await authedPost(app, '/api/v1/auth/family-code/rotate', first.deviceToken)
    expect(rotate.status).toBe(200)
    const body = (await rotate.json()) as { success: boolean; data: { familyCode: string } }
    const newCode = body.data.familyCode
    expect(newCode).not.toBe(currentFamilyCode)
    expect((await registerRequest(app, currentFamilyCode, 'old-code-device')).status).toBe(401)
    expect((await registerRequest(app, newCode, 'new-code-device')).status).toBe(200)
    currentFamilyCode = newCode
  })

  it('旧码验证与轮换交错：轮换提交后绝不签发 token', async () => {
    let releaseVerify: (() => void) | undefined
    let verifyStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      verifyStarted = resolve
    })
    const gate = new Promise<void>((resolve) => {
      releaseVerify = resolve
    })
    const racingApp = makeTestApp(pg, {
      source: '203.0.113.22',
      hasher: {
        hash: argon2Hasher.hash,
        verify: async (phc, secret) => {
          verifyStarted?.()
          await gate
          return argon2Hasher.verify(phc, secret)
        },
      },
    })
    const racing = registerRequest(racingApp, currentFamilyCode, 'racer')
    await started
    // 校验挂起期间完成轮换
    const rotate = await authedPost(app, '/api/v1/auth/family-code/rotate', first.deviceToken)
    expect(rotate.status).toBe(200)
    currentFamilyCode = (
      (await rotate.json()) as { success: boolean; data: { familyCode: string } }
    ).data.familyCode
    releaseVerify?.()
    const raced = await racing
    expect(raced.status).toBe(401)
    expect(((await raced.json()) as EnvelopeBody<unknown>).errCode).toBe('INVALID_FAMILY_CODE')
    const rows = await pg.sql.unsafe(
      "select count(*)::text as count from device_tokens where device_name = 'racer'",
    )
    expect(rows[0]?.count).toBe('0')
  })

  it('logout 撤销当前 token，随后访问受保护路由 → 401', async () => {
    const reg = await registerRequest(app, currentFamilyCode, 'logout-device')
    const device = ((await reg.json()) as { success: boolean; data: AuthResult }).data
    const out = await authedPost(app, '/api/v1/auth/logout', device.deviceToken)
    expect(out.status).toBe(200)
    expect(((await out.json()) as { success: boolean; data: unknown }).data).toEqual({
      revoked: true,
    })
    const after = await authedGet(app, '/api/v1/auth/devices', device.deviceToken)
    expect(after.status).toBe(401)
  })

  it('设备列表只含未撤销设备且 isCurrent 恰有一个', async () => {
    const res = await authedGet(app, '/api/v1/auth/devices', first.deviceToken)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      success: boolean
      data: {
        items: Array<{
          id: string
          deviceName: string
          isCurrent: boolean
          createdAt: string
          lastUsedAt: string
        }>
      }
    }
    const names = body.data.items.map((item) => item.deviceName)
    expect(names).not.toContain('logout-device')
    expect(body.data.items.find((item) => item.id === first.deviceId)?.isCurrent).toBe(true)
    expect(body.data.items.filter((item) => item.isCurrent)).toHaveLength(1)
    for (const item of body.data.items) {
      expect(item.createdAt).toMatch(/Z$/)
      expect(item.lastUsedAt).toMatch(/Z$/)
    }
  })

  it('撤销其它设备：目标 token 立即 401，撤销者不受影响', async () => {
    const reg = await registerRequest(app, currentFamilyCode, 'victim-device')
    const victim = ((await reg.json()) as { success: boolean; data: AuthResult }).data
    const revoke = await authedDelete(
      app,
      '/api/v1/auth/devices/' + victim.deviceId,
      first.deviceToken,
    )
    expect(revoke.status).toBe(200)
    expect(((await revoke.json()) as { success: boolean; data: unknown }).data).toEqual({
      id: victim.deviceId,
      revoked: true,
    })
    const victimRes = await authedGet(app, '/api/v1/auth/devices', victim.deviceToken)
    expect(victimRes.status).toBe(401)
    const self = await authedGet(app, '/api/v1/auth/devices', first.deviceToken)
    expect(self.status).toBe(200)
  })

  it('撤销不存在设备 → 404 DEVICE_NOT_FOUND；非法 UUID → 400 BAD_REQUEST', async () => {
    const ghost = await authedDelete(
      app,
      '/api/v1/auth/devices/99999999-9999-4999-8999-999999999999',
      first.deviceToken,
    )
    expect(ghost.status).toBe(404)
    expect(((await ghost.json()) as EnvelopeBody<unknown>).errCode).toBe('DEVICE_NOT_FOUND')
    const malformed = await authedDelete(app, '/api/v1/auth/devices/not-a-uuid', first.deviceToken)
    expect(malformed.status).toBe(400)
    expect(((await malformed.json()) as EnvelopeBody<unknown>).errCode).toBe('BAD_REQUEST')
  })

  it('允许撤销当前设备', async () => {
    const reg = await registerRequest(app, currentFamilyCode, 'self-revoke-device')
    const device = ((await reg.json()) as { success: boolean; data: AuthResult }).data
    const revoke = await authedDelete(
      app,
      '/api/v1/auth/devices/' + device.deviceId,
      device.deviceToken,
    )
    expect(revoke.status).toBe(200)
    const after = await authedGet(app, '/api/v1/auth/devices', device.deviceToken)
    expect(after.status).toBe(401)
  })

  it('受保护路由：缺 token / 垃圾 token / 非 Bearer 一律 401 UNAUTHORIZED', async () => {
    const noAuth = await app.request('/api/v1/sync')
    expect(noAuth.status).toBe(401)
    expect(((await noAuth.json()) as EnvelopeBody<unknown>).errCode).toBe('UNAUTHORIZED')
    const garbage = await app.request('/api/v1/sync', {
      headers: { Authorization: 'Bearer not-a-real-token' },
    })
    expect(garbage.status).toBe(401)
    // 43 字符合法 base64url 但未注册：走 SHA-256 查表落空分支
    const unknown = await app.request('/api/v1/sync', {
      headers: { Authorization: 'Bearer ' + 'A'.repeat(43) },
    })
    expect(unknown.status).toBe(401)
    const wrongScheme = await app.request('/api/v1/sync', {
      headers: { Authorization: 'Basic abc' },
    })
    expect(wrongScheme.status).toBe(401)
    // RFC 7235：scheme 名大小写不敏感（小写 bearer 同样放行未命中路径）
    const lowerScheme = await app.request('/api/v1/sync', {
      headers: { Authorization: 'bearer ' + 'A'.repeat(43) },
    })
    expect(lowerScheme.status).toBe(401)
  })

  it('deviceName 仅空白 → 400 BAD_REQUEST（trim 后为空）', async () => {
    const res = await registerRequest(app, currentFamilyCode, '   ')
    expect(res.status).toBe(400)
    expect(((await res.json()) as EnvelopeBody<unknown>).errCode).toBe('BAD_REQUEST')
  })

  it('超过 1MB 的请求体 → 400 BAD_REQUEST（content-length 快进路径）', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyCode: 'A'.repeat(1_048_600), deviceName: 'big' }),
    })
    expect(res.status).toBe(400)
    expect(((await res.json()) as EnvelopeBody<unknown>).errCode).toBe('BAD_REQUEST')
  })

  it('家庭码规范化端到端：O→0、空格与连字符均可注册', async () => {
    // 直接替换 auth_config 的家庭码哈希，保证可确定性构造含 0 的已知码
    const code = '0123456789AB'
    const hash = await argon2Hasher.hash(code)
    await pg.sql.begin(async (tx) => {
      await tx.unsafe(
        'update auth_config set family_code_hash = $1, family_code_version = family_code_version + 1, updated_at = now() where singleton = true',
        [hash],
      )
    })
    const res = await registerRequest(app, 'O123 4567 89AB', 'mapped-device')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; data: { deviceToken: string } }
    expect(body.data.deviceToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('请求 schema 校验失败 → 400 BAD_REQUEST 且带 details', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyCode: 'ABCD-EFGH-JKMN' }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as EnvelopeBody<unknown>
    expect(body.errCode).toBe('BAD_REQUEST')
    expect(Array.isArray(body.details)).toBe(true)
    expect((body.details ?? [])[0]?.reason).toBeTruthy()
  })
})

describe('设备认证时间源', () => {
  let pg: TestPostgres

  beforeAll(async () => {
    pg = await startTestPostgres()
  })

  afterAll(async () => {
    await pg.stop()
  })

  it('数据库时钟领先时，受保护请求不会回退最后使用时间', async () => {
    const app = makeTestApp(pg, { source: '203.0.113.26' })
    const device = await bootstrapDevice(app, 'clock-skew-device')
    await pg.sql.unsafe(
      "update device_tokens set created_at = now() + interval '1 minute', last_used_at = now() + interval '1 minute' where id = $1",
      [device.deviceId],
    )

    const res = await authedGet(app, '/api/v1/auth/devices', device.deviceToken)

    expect(res.status).toBe(200)
    const rows = await pg.sql.unsafe<Array<{ created_at: string; last_used_at: string }>>(
      'select created_at, last_used_at from device_tokens where id = $1',
      [device.deviceId],
    )
    const row = rows[0]
    expect(row).toBeDefined()
    expect(new Date(row?.last_used_at ?? 0).getTime()).toBeGreaterThanOrEqual(
      new Date(row?.created_at ?? 0).getTime(),
    )
  })
})

describe('并发 bootstrap（AC5 竞争）', () => {
  let pg: TestPostgres

  beforeAll(async () => {
    pg = await startTestPostgres()
  })

  afterAll(async () => {
    await pg.stop()
  })

  it('并发 bootstrap 恰有一个成功，其余 409，且只产生一套初始化数据', async () => {
    const appA = makeTestApp(pg, { source: '203.0.113.60' })
    const appB = makeTestApp(pg, { source: '203.0.113.61' })
    const attempt = (app: ReturnType<typeof makeTestApp>) =>
      app.request('/api/v1/auth/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bootstrapSecret: TEST_BOOTSTRAP_SECRET, deviceName: 'racer' }),
      })
    const [resA, resB] = await Promise.all([attempt(appA), attempt(appB)])
    expect([resA.status, resB.status].sort()).toEqual([200, 409])
    const loser = resA.status === 409 ? resA : resB
    expect(((await loser.json()) as EnvelopeBody<unknown>).errCode).toBe('ALREADY_INITIALIZED')
    const rows = await pg.sql.unsafe(
      'select (select count(*)::text from auth_config) as configs, ' +
        '(select count(*)::text from device_tokens) as devices, ' +
        '(select count(*)::text from settings) as settings_count, ' +
        '(select count(*)::text from sync_changes) as changes',
    )
    expect(rows[0]).toEqual({ configs: '1', devices: '1', settings_count: '1', changes: '1' })
  })
})
