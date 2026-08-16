/**
 * 认证限流 — AuthAttemptThrottle 行锁事务
 *
 * 每个 (scope, source_key_hash) 原子更新失败计数；第 5 次连续失败锁定 15 分钟。
 * 锁定期内不执行昂贵 hash 验证；到期后的首次尝试重置计数开启新周期。
 * 计数持久化在 PostgreSQL，服务重启不清零，并发不能绕过第 5 次阈值。
 */
import { and, eq } from 'drizzle-orm'
import type { Db } from '../../db/pool.js'
import { authAttemptThrottles } from '../../db/schema/auth.js'

export type AuthScope = 'bootstrap' | 'register'

export interface ThrottleVerdict {
  locked: boolean
  retryAfterSeconds?: number
}

export const THROTTLE_MAX_FAILURES = 5
export const THROTTLE_LOCK_MILLIS = 15 * 60_000

function remainingSeconds(lockedUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000))
}

/** 检查是否处于锁定期；到期则在同一事务重置计数。 */
export async function checkThrottle(
  db: Db,
  scope: AuthScope,
  sourceKeyHash: string,
  now: Date,
): Promise<ThrottleVerdict> {
  return db.transaction(async (tx) => {
    await tx.insert(authAttemptThrottles).values({ scope, sourceKeyHash }).onConflictDoNothing()
    const rows = await tx
      .select()
      .from(authAttemptThrottles)
      .where(
        and(
          eq(authAttemptThrottles.scope, scope),
          eq(authAttemptThrottles.sourceKeyHash, sourceKeyHash),
        ),
      )
      .for('update')
    const row = rows[0]
    if (row === undefined) return { locked: false }

    if (row.lockedUntil !== null && row.lockedUntil.getTime() > now.getTime()) {
      return { locked: true, retryAfterSeconds: remainingSeconds(row.lockedUntil, now) }
    }
    if (row.lockedUntil !== null) {
      await tx
        .update(authAttemptThrottles)
        .set({ failureCount: 0, lockedUntil: null, updatedAt: now })
        .where(
          and(
            eq(authAttemptThrottles.scope, scope),
            eq(authAttemptThrottles.sourceKeyHash, sourceKeyHash),
          ),
        )
    }
    return { locked: false }
  })
}

/** 记录一次凭证失败；达到第 5 次时锁定并返回剩余秒数。 */
export async function recordThrottleFailure(
  db: Db,
  scope: AuthScope,
  sourceKeyHash: string,
  now: Date,
): Promise<ThrottleVerdict> {
  return db.transaction(async (tx) => {
    await tx.insert(authAttemptThrottles).values({ scope, sourceKeyHash }).onConflictDoNothing()
    const rows = await tx
      .select()
      .from(authAttemptThrottles)
      .where(
        and(
          eq(authAttemptThrottles.scope, scope),
          eq(authAttemptThrottles.sourceKeyHash, sourceKeyHash),
        ),
      )
      .for('update')
    const row = rows[0]
    if (row === undefined) return { locked: false }

    const failureCount = row.failureCount + 1
    if (failureCount >= THROTTLE_MAX_FAILURES) {
      const lockedUntil = new Date(now.getTime() + THROTTLE_LOCK_MILLIS)
      await tx
        .update(authAttemptThrottles)
        .set({ failureCount, lockedUntil, updatedAt: now })
        .where(
          and(
            eq(authAttemptThrottles.scope, scope),
            eq(authAttemptThrottles.sourceKeyHash, sourceKeyHash),
          ),
        )
      return { locked: true, retryAfterSeconds: remainingSeconds(lockedUntil, now) }
    }

    await tx
      .update(authAttemptThrottles)
      .set({ failureCount, updatedAt: now })
      .where(
        and(
          eq(authAttemptThrottles.scope, scope),
          eq(authAttemptThrottles.sourceKeyHash, sourceKeyHash),
        ),
      )
    return { locked: false }
  })
}
