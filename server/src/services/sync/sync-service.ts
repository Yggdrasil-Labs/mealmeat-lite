import { and, eq, type SQL, sql } from 'drizzle-orm'
import type { AppConfig } from '../../config.js'
import type {
  AppliedResultDto,
  RejectedResultDto,
  SyncActionDto,
  SyncActionResultDto,
  SyncActionsResponse,
  SyncChangeDto,
  SyncResponse,
} from '../../contracts/generated/schemas.js'
import { syncChangeRowToContract } from '../../contracts/mappers/sync.js'
import { validateVersionedJsonb } from '../../contracts/mappers/versioned-jsonb.js'
import { validateContract } from '../../contracts/validation.js'
import type { Db } from '../../db/pool.js'
import { unwrapPostgresError } from '../../db/postgres-error.js'
import { type SyncChangeRow, syncActionReceipts } from '../../db/schema/sync.js'
import {
  type Database,
  SYNC_WRITE_ADVISORY_LOCK_KEY,
  type SyncWriteContext,
  type SyncWriteTransaction,
  withSyncWriteTransaction,
} from '../../db/transactions/sync-write.js'
import { PublicError } from '../../errors.js'
import { canonicalizeRfc8785, sha256Hex } from '../../security/crypto.js'
import { currentWeekStartMonday } from '../../utils/dates.js'
import {
  decodeSyncCursor,
  encodeSyncCursor,
  type SyncIncrementalCursorPayload,
  type SyncSnapshotCursorPayload,
  syncCursorKey,
} from './cursor.js'
import { paginateSyncChanges } from './paging.js'

export interface SyncServiceDeps {
  getConfig(): AppConfig
  getDb(): Db
  clock?: () => Date
  /** 测试注入屏障：applyAction 在读取回执前挂起（生产不设，no-op）。 */
  beforeActionReceiptCheck?: () => Promise<void>
}

const PAGE_BYTE_LIMIT = 1_048_576

interface RawSyncChangeRow {
  server_version: string
  resource: string
  resource_id: string
  operation: string
  payload: unknown
  payload_schema_version: number
  created_at: Date
}

interface RawRecipeRow {
  id: string
  name: string
  tags: string[]
  ingredients: string[]
  steps: string[]
  image_url: string | null
  notes: string | null
  deleted_at: Date | null
  server_version: string
  created_at: Date
  updated_at: Date
}

interface SqlExecutor {
  execute(query: SQL): Promise<unknown>
}

const RECIPE_COLUMNS =
  'id, name, tags, ingredients, steps, image_url, notes, deleted_at, server_version, created_at, updated_at'

/** 把字符串数组编码为 PG text[] 字面量（元素始终双引号包裹并按 PG 规则转义）。 */
function pgTextArrayLiteral(values: readonly string[]): string {
  const escaped = values.map(
    (value) => '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"',
  )
  return '{' + escaped.join(',') + '}'
}

export class SyncService {
  constructor(private readonly deps: SyncServiceDeps) {}

  private get db(): Db {
    return this.deps.getDb()
  }

  private get now(): Date {
    return (this.deps.clock ?? (() => new Date()))()
  }

  async syncChanges(cursor: string | null, queryLimit: number): Promise<SyncResponse> {
    const key = syncCursorKey(this.deps.getConfig())
    if (cursor !== null) {
      const payload = decodeSyncCursor(cursor, key)
      if (payload === null) throw new PublicError('INVALID_CURSOR')
      if (payload.phase === 'snapshot') return this.snapshotPage(payload, key, false)
      return this.incrementalPage(payload, key)
    }
    return this.snapshotPage(
      { schemaVersion: 1, phase: 'snapshot', watermark: '', limit: queryLimit },
      key,
      true,
    )
  }

  private async snapshotPage(
    payload: SyncSnapshotCursorPayload,
    key: Buffer,
    isFirstPage: boolean,
  ): Promise<SyncResponse> {
    let watermark = 0n
    let beyond = false
    let rawRows: RawSyncChangeRow[] = []

    if (isFirstPage) {
      await this.db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock_shared(${SYNC_WRITE_ADVISORY_LOCK_KEY})`)
        const watermarkRows = await tx.execute(
          sql`select coalesce(max(server_version), 0) as watermark from sync_changes`,
        )
        watermark = BigInt(
          (watermarkRows as unknown as Array<{ watermark: string }>)[0]?.watermark ?? '0',
        )
        rawRows = (await tx.execute(
          this.snapshotQuery(watermark, payload.limit, undefined, undefined),
        )) as unknown as RawSyncChangeRow[]
        beyond = await this.fetchBeyond(tx, watermark)
      })
    } else {
      watermark = BigInt(payload.watermark)
      rawRows = (await this.db.execute(
        this.snapshotQuery(watermark, payload.limit, payload.lastResource, payload.lastResourceId),
      )) as unknown as RawSyncChangeRow[]
      beyond = await this.fetchBeyond(this.db, watermark)
    }

    const { changes, truncated } = this.assemblePage(rawRows, payload.limit)
    if (truncated) {
      const last = rawRows[changes.length - 1]
      if (last !== undefined) {
        const next: SyncSnapshotCursorPayload = {
          schemaVersion: 1,
          phase: 'snapshot',
          watermark: watermark.toString(),
          lastResource: last.resource,
          lastResourceId: last.resource_id,
          limit: payload.limit,
        }
        return this.buildResponse(changes, encodeSyncCursor(next, key), true)
      }
    }
    if (beyond) {
      const next: SyncIncrementalCursorPayload = {
        schemaVersion: 1,
        phase: 'incremental',
        lastServerVersion: watermark.toString(),
        limit: payload.limit,
      }
      return this.buildResponse(changes, encodeSyncCursor(next, key), true)
    }
    return this.buildResponse(changes, undefined, false)
  }

  private snapshotQuery(
    watermark: bigint,
    limit: number,
    lastResource: string | undefined,
    lastResourceId: string | undefined,
  ): SQL {
    return sql`
      select server_version, resource, resource_id, operation, payload, payload_schema_version, created_at from (
        select distinct on (resource, resource_id)
          server_version, resource, resource_id, operation, payload, payload_schema_version, created_at
        from sync_changes
        where server_version <= ${watermark}
        order by resource asc, resource_id asc, server_version desc
      ) snapshot_latest
      ${
        lastResource !== undefined
          ? sql`where (resource, resource_id) > (${lastResource}, ${lastResourceId})`
          : sql``
      }
      order by resource asc, resource_id asc
      limit ${limit + 1}
    `
  }

  private async fetchBeyond(executor: SqlExecutor, watermark: bigint): Promise<boolean> {
    const rows = await executor.execute(
      sql`select 1 as marker from sync_changes where server_version > ${watermark} limit 1`,
    )
    return (rows as unknown[]).length > 0
  }

  private async incrementalPage(
    payload: SyncIncrementalCursorPayload,
    key: Buffer,
  ): Promise<SyncResponse> {
    const rawRows = (await this.db.execute(sql`
      select server_version, resource, resource_id, operation, payload, payload_schema_version, created_at
      from sync_changes
      where server_version > ${BigInt(payload.lastServerVersion)}
      order by server_version asc
      limit ${payload.limit + 1}
    `)) as unknown as RawSyncChangeRow[]

    const { changes, truncated } = this.assemblePage(rawRows, payload.limit)
    if (!truncated) return this.buildResponse(changes, undefined, false)
    const last = rawRows[changes.length - 1]
    if (last === undefined) return this.buildResponse(changes, undefined, false)
    const next: SyncIncrementalCursorPayload = {
      schemaVersion: 1,
      phase: 'incremental',
      lastServerVersion: last.server_version,
      limit: payload.limit,
    }
    return this.buildResponse(changes, encodeSyncCursor(next, key), true)
  }

  private assemblePage(
    rawRows: RawSyncChangeRow[],
    limit: number,
  ): {
    changes: SyncChangeDto[]
    truncated: boolean
  } {
    const changes = rawRows.map((raw) => this.rowToChange(raw))
    // 1MB 按 wire 实际 UTF-8 字节度量（冻结契约），见 paging.ts
    const { page, truncated } = paginateSyncChanges(changes, limit, PAGE_BYTE_LIMIT)
    return { changes: page, truncated }
  }

  private buildResponse(
    changes: SyncChangeDto[],
    nextCursor: string | undefined,
    hasMore: boolean,
  ): SyncResponse {
    const value = { changes, hasMore, ...(nextCursor === undefined ? {} : { nextCursor }) }
    const checked = validateContract('SyncResponse', value)
    if (!checked.success) throw new PublicError('INTERNAL_ERROR')
    return checked.value
  }

  private rowToChange(raw: RawSyncChangeRow): SyncChangeDto {
    const row: SyncChangeRow = {
      serverVersion: BigInt(raw.server_version),
      resource: raw.resource,
      resourceId: raw.resource_id,
      operation: raw.operation,
      payload: raw.payload,
      payloadSchemaVersion: raw.payload_schema_version,
      createdAt: new Date(raw.created_at),
    }
    return syncChangeRowToContract(row)
  }

  async applyActions(
    deviceId: string,
    actions: readonly SyncActionDto[],
  ): Promise<SyncActionsResponse> {
    const results: SyncActionResultDto[] = []
    for (const action of actions) {
      results.push(await this.applyAction(deviceId, action))
    }
    const checked = validateContract('SyncActionsResponse', { results })
    if (!checked.success) throw new PublicError('INTERNAL_ERROR')
    return checked.value
  }

  private async applyAction(deviceId: string, action: SyncActionDto): Promise<SyncActionResultDto> {
    const payloadHash = sha256Hex(canonicalizeRfc8785(action.payload))
    await this.deps.beforeActionReceiptCheck?.()
    const existing = await this.db
      .select()
      .from(syncActionReceipts)
      .where(
        and(
          eq(syncActionReceipts.deviceId, deviceId),
          eq(syncActionReceipts.actionId, action.actionId),
        ),
      )
    const receipt = existing[0]
    if (receipt !== undefined) {
      return this.replayReceipt(action, payloadHash, receipt)
    }

    try {
      if (action.type === 'recipe.patch') {
        return await this.applyRecipePatch(deviceId, action, payloadHash)
      }
      return await this.applyRecipeDelete(deviceId, action, payloadHash)
    } catch (err) {
      // 并发重复上传：先写者提交回执后，后写者撞主键 —— 重读回执按幂等键重放
      const postgresError = unwrapPostgresError(err)
      if (postgresError !== null && postgresError.code === '23505') {
        const rows = await this.db
          .select()
          .from(syncActionReceipts)
          .where(
            and(
              eq(syncActionReceipts.deviceId, deviceId),
              eq(syncActionReceipts.actionId, action.actionId),
            ),
          )
        const receipt = rows[0]
        if (receipt !== undefined) {
          return this.replayReceipt(action, payloadHash, receipt)
        }
      }
      throw err
    }
  }

  private replayReceipt(
    action: SyncActionDto,
    payloadHash: string,
    receipt: typeof syncActionReceipts.$inferSelect,
  ): SyncActionResultDto {
    if (receipt.actionType !== action.type || receipt.payloadHash !== payloadHash) {
      throw new PublicError('IDEMPOTENCY_KEY_REUSED', {
        details: [{ field: 'actionId', reason: action.actionId }],
      })
    }
    const stored = validateVersionedJsonb(
      'sync_action_receipt.result',
      receipt.resultSchemaVersion,
      receipt.result,
    )
    const original: Record<string, unknown> = { ...(stored as Record<string, unknown>) }
    delete original.actionId
    return {
      actionId: action.actionId,
      status: 'duplicate',
      original: original as unknown as AppliedResultDto | RejectedResultDto,
    }
  }

  private async applyRecipePatch(
    deviceId: string,
    action: Extract<SyncActionDto, { type: 'recipe.patch' }>,
    payloadHash: string,
  ): Promise<SyncActionResultDto> {
    const { recipeId, patch } = action.payload
    return withSyncWriteTransaction(
      this.syncWriteDatabase(),
      [{ resource: 'recipe', id: recipeId }],
      async (ctx) => {
        const rows = (await ctx.tx.execute(
          sql`select ${sql.raw(RECIPE_COLUMNS)} from recipes where id = ${recipeId}`,
        )) as unknown as RawRecipeRow[]
        const row = rows[0]
        if (row === undefined) {
          return this.persistRejected(ctx, deviceId, action, payloadHash, {
            status: 'rejected',
            errCode: 'RECIPE_NOT_FOUND',
            errMessage: 'Recipe not found',
            requiresFullResync: true,
          })
        }
        if (row.deleted_at !== null) {
          return this.persistRejected(
            ctx,
            deviceId,
            action,
            payloadHash,
            {
              status: 'rejected',
              errCode: 'RECIPE_DELETED',
              errMessage: 'Recipe is deleted',
              requiresFullResync: false,
              authoritative: this.rowToTombstone(row),
              serverVersion: row.server_version,
            },
            BigInt(row.server_version),
          )
        }
        const version = await ctx.nextServerVersion()
        const assignments: SQL[] = []
        if (patch.name !== undefined) assignments.push(sql`name = ${patch.name}`)
        if (patch.tags !== undefined) {
          // drizzle 的 sql 模板会展开数组参数，必须转成单参数的 PG text[] 字面量
          assignments.push(sql`tags = ${pgTextArrayLiteral(patch.tags)}::text[]`)
        }
        assignments.push(sql`updated_at = now()`)
        assignments.push(sql`server_version = ${version}`)
        await ctx.tx.execute(
          sql`update recipes set ${sql.join(assignments, sql`, `)} where id = ${recipeId}`,
        )
        const updated = (
          (await ctx.tx.execute(
            sql`select ${sql.raw(RECIPE_COLUMNS)} from recipes where id = ${recipeId}`,
          )) as unknown as RawRecipeRow[]
        )[0]
        if (updated === undefined) throw new PublicError('INTERNAL_ERROR')
        const view = this.rowToRecipeView(updated)
        await ctx.tx.execute(
          sql`insert into sync_changes (server_version, resource, resource_id, operation, payload, payload_schema_version, created_at) values (${version}, 'recipe', ${recipeId}, 'upsert', ${JSON.stringify(view)}::jsonb, 1, now())`,
        )
        const result: SyncActionResultDto = {
          actionId: action.actionId,
          status: 'applied',
          serverVersion: version.toString(),
          resource: view,
        }
        await this.insertReceipt(ctx.tx, deviceId, action, payloadHash, 'applied', result, version)
        return result
      },
    )
  }

  private async applyRecipeDelete(
    deviceId: string,
    action: Extract<SyncActionDto, { type: 'recipe.delete' }>,
    payloadHash: string,
  ): Promise<SyncActionResultDto> {
    const { recipeId } = action.payload
    return withSyncWriteTransaction(
      this.syncWriteDatabase(),
      [{ resource: 'recipe', id: recipeId }],
      async (ctx) => {
        const rows = (await ctx.tx.execute(
          sql`select ${sql.raw(RECIPE_COLUMNS)} from recipes where id = ${recipeId}`,
        )) as unknown as RawRecipeRow[]
        const row = rows[0]
        if (row === undefined) {
          return this.persistRejected(ctx, deviceId, action, payloadHash, {
            status: 'rejected',
            errCode: 'RECIPE_NOT_FOUND',
            errMessage: 'Recipe not found',
            requiresFullResync: true,
          })
        }
        if (row.deleted_at !== null) {
          // 幂等：已删除则返回既有墓碑，不分配新版本、不发新 SyncChange
          const result: SyncActionResultDto = {
            actionId: action.actionId,
            status: 'applied',
            serverVersion: row.server_version,
            resource: this.rowToTombstone(row),
          }
          await this.insertReceipt(
            ctx.tx,
            deviceId,
            action,
            payloadHash,
            'applied',
            result,
            BigInt(row.server_version),
          )
          return result
        }
        const monday = currentWeekStartMonday(this.now)
        const refs = await ctx.tx.execute(
          sql`select 1 as marker from plan_items pi join weekly_plans wp on wp.id = pi.weekly_plan_id where pi.recipe_id = ${recipeId} and wp.week_start >= ${monday} limit 1`,
        )
        if ((refs as unknown[]).length > 0) {
          return this.persistRejected(
            ctx,
            deviceId,
            action,
            payloadHash,
            {
              status: 'rejected',
              errCode: 'RECIPE_IN_USE',
              errMessage: 'Recipe is referenced by a current or future plan',
              requiresFullResync: false,
              authoritative: this.rowToRecipeView(row),
              serverVersion: row.server_version,
            },
            BigInt(row.server_version),
          )
        }
        const version = await ctx.nextServerVersion()
        await ctx.tx.execute(
          sql`update recipes set deleted_at = now(), updated_at = now(), server_version = ${version} where id = ${recipeId}`,
        )
        const updated = (
          (await ctx.tx.execute(
            sql`select ${sql.raw(RECIPE_COLUMNS)} from recipes where id = ${recipeId}`,
          )) as unknown as RawRecipeRow[]
        )[0]
        if (updated === undefined) throw new PublicError('INTERNAL_ERROR')
        const tombstone = this.rowToTombstone(updated)
        await ctx.tx.execute(
          sql`insert into sync_changes (server_version, resource, resource_id, operation, payload, payload_schema_version, created_at) values (${version}, 'recipe', ${recipeId}, 'delete', ${JSON.stringify(tombstone)}::jsonb, 1, now())`,
        )
        const result: SyncActionResultDto = {
          actionId: action.actionId,
          status: 'applied',
          serverVersion: version.toString(),
          resource: tombstone,
        }
        await this.insertReceipt(ctx.tx, deviceId, action, payloadHash, 'applied', result, version)
        return result
      },
    )
  }

  private async persistRejected(
    ctx: SyncWriteContext,
    deviceId: string,
    action: SyncActionDto,
    payloadHash: string,
    rejected: RejectedResultDto,
    serverVersion: bigint | null = null,
  ): Promise<SyncActionResultDto> {
    const result = { actionId: action.actionId, ...rejected } as SyncActionResultDto
    await this.insertReceipt(
      ctx.tx,
      deviceId,
      action,
      payloadHash,
      'rejected',
      result,
      serverVersion,
    )
    return result
  }

  private async insertReceipt(
    tx: SyncWriteTransaction,
    deviceId: string,
    action: SyncActionDto,
    payloadHash: string,
    status: 'applied' | 'rejected',
    result: SyncActionResultDto,
    serverVersion: bigint | null,
  ): Promise<void> {
    await tx.execute(
      sql`insert into sync_action_receipts (device_id, action_id, action_type, payload_hash, status, result, result_schema_version, server_version, created_at) values (${deviceId}::uuid, ${action.actionId}::uuid, ${action.type}, ${payloadHash}, ${status}, ${JSON.stringify(result)}::jsonb, 1, ${serverVersion}, now())`,
    )
  }

  private syncWriteDatabase(): Database {
    const db = this.db
    return {
      transaction: (work) =>
        db.transaction((tx) => work({ execute: (query) => tx.execute(query) })),
    }
  }

  private rowToRecipeView(raw: RawRecipeRow) {
    const value = {
      id: raw.id,
      name: raw.name,
      tags: raw.tags,
      ingredients: raw.ingredients,
      steps: raw.steps,
      ...(raw.image_url === null ? {} : { imageUrl: raw.image_url }),
      ...(raw.notes === null ? {} : { notes: raw.notes }),
      serverVersion: raw.server_version,
      createdAt: new Date(raw.created_at).toISOString(),
      updatedAt: new Date(raw.updated_at).toISOString(),
    }
    const checked = validateContract('RecipeView', value)
    if (!checked.success) throw new PublicError('INTERNAL_ERROR')
    return checked.value
  }

  private rowToTombstone(raw: RawRecipeRow) {
    const value = {
      id: raw.id,
      deletedAt: new Date(raw.deleted_at as Date).toISOString(),
      serverVersion: raw.server_version,
    }
    const checked = validateContract('RecipeTombstone', value)
    if (!checked.success) throw new PublicError('INTERNAL_ERROR')
    return checked.value
  }
}
