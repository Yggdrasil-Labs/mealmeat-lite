import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  authedGet,
  bootstrapDevice,
  type EnvelopeBody,
  makeTestApp,
  startTestPostgres,
  type TestPostgres,
} from '../test-support/pg.js'

interface DeviceAuth {
  deviceId: string
  deviceToken: string
}

function recipeId(n: number): string {
  return '11111111-1111-4111-8111-' + String(n).padStart(12, '0')
}

function actionId(n: number): string {
  return '00000000-0000-4000-8000-' + String(n).padStart(12, '0')
}

const CREATED_AT = '2026-07-01T00:00:00Z'

async function seedRecipe(sql: TestPostgres['sql'], id: string, name: string, version: number) {
  await sql.unsafe(
    'insert into recipes (id, name, tags, ingredients, steps, server_version, created_at, updated_at) ' +
      "values ($1, $2, '{}', '{}', '{}', $3, now(), now())",
    [id, name, version],
  )
  const view = {
    id,
    name,
    tags: [],
    ingredients: [],
    steps: [],
    serverVersion: String(version),
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  }
  await sql.unsafe(
    'insert into sync_changes (server_version, resource, resource_id, operation, payload, payload_schema_version, created_at) ' +
      "values ($1, 'recipe', $2, 'upsert', $3::jsonb, 1, now())",
    [version, id, JSON.stringify(view)],
  )
}

/** 走全局 sequence 分配版本地播种菜谱 + 对应 SyncChange（写路径测试用），返回分配的版本。 */
async function seedRecipeSeq(sql: TestPostgres['sql'], id: string, name: string): Promise<string> {
  const rows = await sql.unsafe(
    'insert into recipes (id, name, tags, ingredients, steps, server_version, created_at, updated_at) ' +
      "values ($1, $2, '{}', '{}', '{}', nextval('sync_server_version_seq'), now(), now()) " +
      'returning server_version::text',
    [id, name],
  )
  const version: string = rows[0]?.server_version ?? ''
  const view = {
    id,
    name,
    tags: [],
    ingredients: [],
    steps: [],
    serverVersion: version,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  }
  await sql.unsafe(
    'insert into sync_changes (server_version, resource, resource_id, operation, payload, payload_schema_version, created_at) ' +
      "values ($1::bigint, 'recipe', $2, 'upsert', $3::jsonb, 1, now())",
    [version, id, JSON.stringify(view)],
  )
  return version
}

async function registerDevice(
  app: ReturnType<typeof makeTestApp>,
  familyCode: string,
  deviceName: string,
) {
  const res = await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familyCode, deviceName }),
  })
  const body = (await res.json()) as { success: boolean; data: DeviceAuth }
  if (!body.success) throw new Error('register helper failed: ' + JSON.stringify(body))
  return body.data
}

async function postActions(app: ReturnType<typeof makeTestApp>, token: string, actions: unknown[]) {
  return app.request('/api/v1/sync/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ actions }),
  })
}

interface SyncBody {
  success: boolean
  data: {
    changes: Array<{
      serverVersion: string
      resource: string
      operation: string
      data: Record<string, unknown>
    }>
    nextCursor?: string
    hasMore: boolean
  }
}

describe('sync 快照与 cursor（AC12）', () => {
  let pg: TestPostgres
  let app: ReturnType<typeof makeTestApp>
  let first: { deviceId: string; deviceToken: string; familyCode: string }

  beforeAll(async () => {
    pg = await startTestPostgres()
    app = makeTestApp(pg, { source: '203.0.113.30' })
    first = await bootstrapDevice(app)
  })

  afterAll(async () => {
    await pg.stop()
  })

  it('bootstrap 后首次快照返回 settings 变更且 hasMore=false', async () => {
    const res = await authedGet(app, '/api/v1/sync', first.deviceToken)
    expect(res.status).toBe(200)
    const body = (await res.json()) as SyncBody
    expect(body.success).toBe(true)
    expect(body.data.hasMore).toBe(false)
    expect(body.data.changes).toHaveLength(1)
    expect(body.data.changes[0]).toMatchObject({
      resource: 'settings',
      operation: 'upsert',
      serverVersion: '1',
      data: { key: 'familyPreference', value: '' },
    })
    expect(body.data.nextCursor).toBeUndefined()
  })

  it('篡改 cursor → 400 INVALID_CURSOR', async () => {
    for (const cursor of ['garbage.cursor', 'a.b', 'not-a-cursor']) {
      const res = await authedGet(
        app,
        '/api/v1/sync?cursor=' + encodeURIComponent(cursor),
        first.deviceToken,
      )
      expect(res.status).toBe(400)
      expect(((await res.json()) as EnvelopeBody<unknown>).errCode).toBe('INVALID_CURSOR')
    }
  })

  it('非法 limit → 400 BAD_REQUEST', async () => {
    for (const limit of ['0', '101', 'abc', '-1', '1.5']) {
      const res = await authedGet(
        app,
        '/api/v1/sync?limit=' + encodeURIComponent(limit),
        first.deviceToken,
      )
      expect(res.status).toBe(400)
      expect(((await res.json()) as EnvelopeBody<unknown>).errCode).toBe('BAD_REQUEST')
    }
  })

  it('快照按 (resource, resource_id) 固定顺序分页直到 hasMore=false（limit=2）', async () => {
    for (let i = 1; i <= 5; i++) await seedRecipe(pg.sql, recipeId(i), 'recipe-' + i, i + 1)
    const seen: string[] = []
    let cursor: string | null = null
    for (let page = 0; page < 10; page++) {
      const url =
        '/api/v1/sync?limit=2' + (cursor === null ? '' : '&cursor=' + encodeURIComponent(cursor))
      const res = await authedGet(app, url, first.deviceToken)
      expect(res.status).toBe(200)
      const body = (await res.json()) as SyncBody
      for (const change of body.data.changes) seen.push(change.resource)
      cursor = body.data.nextCursor ?? null
      if (!body.data.hasMore) break
    }
    expect(seen).toHaveLength(6)
    expect(seen).toEqual(['recipe', 'recipe', 'recipe', 'recipe', 'recipe', 'settings'])
  })

  it('分页期间的新写入在水位之后经增量 cursor 续传，不漏失', async () => {
    const firstPage = await authedGet(app, '/api/v1/sync?limit=1', first.deviceToken)
    const page1 = (await firstPage.json()) as SyncBody
    expect(page1.data.changes).toHaveLength(1)
    const cursor1 = page1.data.nextCursor
    expect(cursor1).toBeTruthy()
    // 快照分页期间提交新写入（新版本高于首屏 watermark）
    await seedRecipe(pg.sql, recipeId(90), 'late-recipe', 7)

    let cursor = cursor1
    let last: SyncBody | null = null
    let pages = 0
    for (;;) {
      expect(cursor).toBeTruthy()
      const res = await authedGet(
        app,
        '/api/v1/sync?limit=1&cursor=' + encodeURIComponent(cursor as string),
        first.deviceToken,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as SyncBody
      last = body
      pages++
      if (!body.data.hasMore) break
      cursor = body.data.nextCursor
      expect(pages).toBeLessThan(20)
    }
    // 快照（v1..v6 的 6 项）结束后经增量页拿到 v7 的新写入
    expect(last?.data.changes).toHaveLength(1)
    expect(last?.data.changes[0]).toMatchObject({
      resource: 'recipe',
      serverVersion: '7',
      data: { name: 'late-recipe' },
    })
  })
})

describe('sync 离线动作（AC6）', () => {
  let pg: TestPostgres
  let app: ReturnType<typeof makeTestApp>
  let first: { deviceId: string; deviceToken: string; familyCode: string }
  let deviceA: DeviceAuth
  let deviceB: DeviceAuth
  let patchVersionA = ''
  let patchVersionB = ''
  let deleteVersion = ''

  beforeAll(async () => {
    pg = await startTestPostgres()
    app = makeTestApp(pg, { source: '203.0.113.40' })
    first = await bootstrapDevice(app)
    deviceA = await registerDevice(app, first.familyCode, 'device-a')
    deviceB = await registerDevice(app, first.familyCode, 'device-b')
  })

  afterAll(async () => {
    await pg.stop()
  })

  it('两台设备离线修改同一菜品：终态等于服务端接收顺序最后成功动作，版本单调递增', async () => {
    const id = recipeId(50)
    const seedVersion = await seedRecipeSeq(pg.sql, id, 'original')
    const patchA = {
      actionId: actionId(1),
      type: 'recipe.patch',
      createdAt: CREATED_AT,
      payload: { recipeId: id, patch: { name: 'patched-by-a' } },
    }
    const patchB = {
      actionId: actionId(2),
      type: 'recipe.patch',
      createdAt: CREATED_AT,
      payload: { recipeId: id, patch: { tags: ['fast'] } },
    }
    const resA = await postActions(app, deviceA.deviceToken, [patchA])
    expect(resA.status).toBe(200)
    const bodyA = (await resA.json()) as {
      success: boolean
      data: { results: Array<Record<string, unknown>> }
    }
    const resultA = bodyA.data.results[0] as { status: string; serverVersion: string }
    expect(resultA).toMatchObject({ actionId: actionId(1), status: 'applied' })
    patchVersionA = resultA.serverVersion
    expect(Number(patchVersionA)).toBe(Number(seedVersion) + 1)

    const resB = await postActions(app, deviceB.deviceToken, [patchB])
    expect(resB.status).toBe(200)
    const bodyB = (await resB.json()) as {
      success: boolean
      data: { results: Array<Record<string, unknown>> }
    }
    const resultB = bodyB.data.results[0] as { status: string; serverVersion: string }
    expect(resultB).toMatchObject({
      actionId: actionId(2),
      status: 'applied',
      resource: { id, name: 'patched-by-a', tags: ['fast'] },
    })
    patchVersionB = resultB.serverVersion
    expect(Number(patchVersionB)).toBeGreaterThan(Number(patchVersionA))

    // DB 终态：后写成功覆盖先写成功（字段级合并，不按客户端时间戳判定）
    const row = await pg.sql.unsafe(
      'select name, tags::text as tags, server_version from recipes where id = $1',
      [id],
    )
    expect(row[0]).toMatchObject({
      name: 'patched-by-a',
      tags: '{fast}',
      server_version: patchVersionB,
    })
    // 该资源的 SyncChange 严格按版本升序，且新写入版本单调
    const changes = await pg.sql.unsafe(
      'select server_version, operation from sync_changes where resource_id = $1 order by server_version asc',
      [id],
    )
    const versionRows = changes as unknown as Array<{ server_version: string; operation: string }>
    expect(versionRows.map((c) => c.server_version)).toEqual([
      seedVersion,
      patchVersionA,
      patchVersionB,
    ])
    expect(versionRows.map((c) => c.operation)).toEqual(['upsert', 'upsert', 'upsert'])
  })

  it('重复上传同一 actionId → duplicate 重放原结果且不重复执行', async () => {
    const patchB = {
      actionId: actionId(2),
      type: 'recipe.patch',
      createdAt: CREATED_AT,
      payload: { recipeId: recipeId(50), patch: { tags: ['fast'] } },
    }
    const res = await postActions(app, deviceB.deviceToken, [patchB])
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      success: boolean
      data: { results: Array<Record<string, unknown>> }
    }
    expect(body.data.results[0]).toMatchObject({
      actionId: actionId(2),
      status: 'duplicate',
      original: { status: 'applied', serverVersion: patchVersionB },
    })
    const counts = await pg.sql.unsafe('select count(*)::text as count from sync_changes')
    expect(counts[0]?.count).toBe('4')
  })

  it('同 actionId 不同 payload → 409 IDEMPOTENCY_KEY_REUSED 且指出 actionId', async () => {
    const conflicting = {
      actionId: actionId(2),
      type: 'recipe.patch',
      createdAt: CREATED_AT,
      payload: { recipeId: recipeId(50), patch: { name: 'other' } },
    }
    const res = await postActions(app, deviceB.deviceToken, [conflicting])
    expect(res.status).toBe(409)
    const body = (await res.json()) as EnvelopeBody<unknown>
    expect(body.errCode).toBe('IDEMPOTENCY_KEY_REUSED')
    expect((body.details ?? [])[0]?.field).toBe('actionId')
  })

  it('patch 不存在的菜谱 → rejected requiresFullResync；重放同 actionId → duplicate', async () => {
    const action = {
      actionId: actionId(3),
      type: 'recipe.patch',
      createdAt: CREATED_AT,
      payload: { recipeId: recipeId(99), patch: { name: 'ghost' } },
    }
    const res = await postActions(app, deviceA.deviceToken, [action])
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      success: boolean
      data: { results: Array<Record<string, unknown>> }
    }
    expect(body.data.results[0]).toMatchObject({
      actionId: actionId(3),
      status: 'rejected',
      errCode: 'RECIPE_NOT_FOUND',
      requiresFullResync: true,
    })
    const replay = await postActions(app, deviceA.deviceToken, [action])
    const replayBody = (await replay.json()) as {
      success: boolean
      data: { results: Array<Record<string, unknown>> }
    }
    expect(replayBody.data.results[0]).toMatchObject({ status: 'duplicate' })
  })

  it('patch 已删除菜谱 → rejected RECIPE_DELETED 且带权威墓碑', async () => {
    const id = recipeId(51)
    await seedRecipeSeq(pg.sql, id, 'doomed')
    const del = {
      actionId: actionId(4),
      type: 'recipe.delete',
      createdAt: CREATED_AT,
      payload: { recipeId: id },
    }
    const delRes = await postActions(app, deviceA.deviceToken, [del])
    expect(delRes.status).toBe(200)
    const delBody = (await delRes.json()) as {
      success: boolean
      data: { results: Array<Record<string, unknown>> }
    }
    const delResult = delBody.data.results[0] as { status: string; serverVersion: string }
    expect(delResult).toMatchObject({ status: 'applied' })
    deleteVersion = delResult.serverVersion

    const patch = {
      actionId: actionId(5),
      type: 'recipe.patch',
      createdAt: CREATED_AT,
      payload: { recipeId: id, patch: { name: 'resurrect' } },
    }
    const res = await postActions(app, deviceB.deviceToken, [patch])
    const body = (await res.json()) as {
      success: boolean
      data: { results: Array<Record<string, unknown>> }
    }
    expect(body.data.results[0]).toMatchObject({
      status: 'rejected',
      errCode: 'RECIPE_DELETED',
      requiresFullResync: false,
      serverVersion: deleteVersion,
      authoritative: { id, deletedAt: expect.any(String), serverVersion: deleteVersion },
    })
  })

  it('对已删除菜谱再次 delete（新 actionId）→ applied 既有墓碑，不分配新版本', async () => {
    const id = recipeId(51)
    const again = {
      actionId: actionId(6),
      type: 'recipe.delete',
      createdAt: CREATED_AT,
      payload: { recipeId: id },
    }
    const res = await postActions(app, deviceA.deviceToken, [again])
    const body = (await res.json()) as {
      success: boolean
      data: { results: Array<Record<string, unknown>> }
    }
    expect(body.data.results[0]).toMatchObject({
      status: 'applied',
      serverVersion: deleteVersion,
    })
    const changes = await pg.sql.unsafe(
      'select count(*)::text as count from sync_changes where resource_id = $1 and operation = $2',
      [id, 'delete'],
    )
    expect(changes[0]?.count).toBe('1')
  })

  it('delete 被当前/未来计划引用的菜谱 → rejected RECIPE_IN_USE + 权威视图', async () => {
    const id = recipeId(52)
    const seedVersion = await seedRecipeSeq(pg.sql, id, 'in-use-recipe')
    const planId = '55555555-5555-4555-8555-555555555555'
    // weekly_plans 的 21 槽位约束触发器在事务提交时检查，头与 21 个槽位必须同事务写入
    await pg.sql.begin(async (tx) => {
      await tx.unsafe(
        "insert into weekly_plans (id, week_start, server_version) values ($1, '2099-01-05', 500)",
        [planId],
      )
      await tx.unsafe(
        'insert into plan_items (weekly_plan_id, date, meal_type, recipe_id, recipe_name_snapshot) ' +
          "select $1::uuid, '2099-01-05'::date + day_offset, meal_type, $2::uuid, 'in-use-recipe' " +
          "from generate_series(0, 6) as day_offset cross join unnest(array['breakfast', 'lunch', 'dinner']) as meal_type",
        [planId, id],
      )
    })
    const del = {
      actionId: actionId(7),
      type: 'recipe.delete',
      createdAt: CREATED_AT,
      payload: { recipeId: id },
    }
    const res = await postActions(app, deviceA.deviceToken, [del])
    const body = (await res.json()) as {
      success: boolean
      data: { results: Array<Record<string, unknown>> }
    }
    expect(body.data.results[0]).toMatchObject({
      status: 'rejected',
      errCode: 'RECIPE_IN_USE',
      requiresFullResync: false,
      authoritative: { id, name: 'in-use-recipe', serverVersion: seedVersion },
    })
  })

  it('批量动作按输入顺序逐项 ACK，部分拒绝不回滚同批其它项', async () => {
    const id = recipeId(53)
    const seedVersion = await seedRecipeSeq(pg.sql, id, 'batch-recipe')
    const batch = [
      {
        actionId: actionId(8),
        type: 'recipe.patch',
        createdAt: CREATED_AT,
        payload: { recipeId: id, patch: { name: 'batch-patched' } },
      },
      {
        actionId: actionId(9),
        type: 'recipe.patch',
        createdAt: CREATED_AT,
        payload: { recipeId: recipeId(98), patch: { name: 'missing' } },
      },
    ]
    const res = await postActions(app, deviceA.deviceToken, batch)
    const body = (await res.json()) as {
      success: boolean
      data: { results: Array<Record<string, unknown>> }
    }
    expect(body.data.results.map((r) => r.actionId)).toEqual([actionId(8), actionId(9)])
    const applied = body.data.results[0] as { status: string; serverVersion: string }
    expect(applied).toMatchObject({ status: 'applied' })
    expect(Number(applied.serverVersion)).toBe(Number(seedVersion) + 1)
    expect(body.data.results[1]).toMatchObject({ status: 'rejected', errCode: 'RECIPE_NOT_FOUND' })
    // 第一项已生效（逐项独立事务）
    const row = await pg.sql.unsafe('select name from recipes where id = $1', [id])
    expect(row[0]?.name).toBe('batch-patched')
  })

  it('整包 schema 失败 → 400 BAD_REQUEST 且不处理任何 action', async () => {
    const res = await postActions(app, deviceA.deviceToken, [{ notAnAction: true }])
    expect(res.status).toBe(400)
    expect(((await res.json()) as EnvelopeBody<unknown>).errCode).toBe('BAD_REQUEST')
  })

  it('未鉴权上传 → 401 UNAUTHORIZED', async () => {
    const res = await app.request('/api/v1/sync/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions: [] }),
    })
    expect(res.status).toBe(401)
  })
})
