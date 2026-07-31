import { describe, expect, it } from 'vitest'
import { type Database, type SyncWriteTransaction, withSyncWriteTransaction } from './sync-write.js'

describe('withSyncWriteTransaction', () => {
  it('takes its global and sorted resource locks before exposing a version allocator', async () => {
    const calls: string[] = []
    const tx: SyncWriteTransaction = {
      async execute() {
        calls.push('lock-or-version')
        return calls.length === 4 ? [{ version: '42' }] : []
      },
    }
    const db: Database = { transaction: (work) => work(tx) }

    const version = await withSyncWriteTransaction(
      db,
      [
        { resource: 'weekly_plan', id: 'b' },
        { resource: 'recipe', id: 'z' },
      ],
      async (context) => {
        expect(calls).toHaveLength(3)
        return context.nextServerVersion()
      },
    )

    expect(version).toBe(42n)
    expect(calls).toHaveLength(4)
  })

  it('propagates a failing callback so the Drizzle transaction can roll back atomically', async () => {
    const tx: SyncWriteTransaction = { execute: async () => [] }
    const db: Database = { transaction: (work) => work(tx) }

    await expect(
      withSyncWriteTransaction(db, [], async () => {
        throw new Error('intentional rollback')
      }),
    ).rejects.toThrow('intentional rollback')
  })
})
