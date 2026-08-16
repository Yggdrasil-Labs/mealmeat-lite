import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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
    const wrongScheme = await app.request('/api/v1/sync', {
      headers: { Authorization: 'Basic abc' },
    })
    expect(wrongScheme.status).toBe(401)
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
