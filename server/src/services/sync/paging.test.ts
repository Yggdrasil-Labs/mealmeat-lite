/**
 * 分页纯函数单元测试 — UTF-8 字节度量与 SYNC_CHANGE_TOO_LARGE
 */
import { describe, expect, it } from 'vitest'
import type { SyncChangeDto } from '../../contracts/generated/schemas.js'
import { PublicError } from '../../errors.js'
import { paginateSyncChanges } from './paging.js'

function settingsChange(value: string): SyncChangeDto {
  return {
    serverVersion: '1',
    resource: 'settings',
    operation: 'upsert',
    data: { key: 'familyPreference', value },
  }
}

const ONE_MB = 1_048_576

describe('paginateSyncChanges', () => {
  it('按 UTF-8 字节截断：两个约 0.6MB 的中文项只放行一页', () => {
    // 200_000 个汉字 ≈ 600KB UTF-8（≈200KB UTF-16 unit）
    const big = settingsChange('菜'.repeat(200_000))
    const result = paginateSyncChanges([big, big], 100, ONE_MB)
    expect(result.truncated).toBe(true)
    expect(result.page).toHaveLength(1)
    // 单页字节数确实低于上限
    expect(Buffer.byteLength(JSON.stringify(result.page[0]), 'utf8')).toBeLessThanOrEqual(ONE_MB)
  })

  it('单项超过 1MB（UTF-8）抛出 SYNC_CHANGE_TOO_LARGE', () => {
    const huge = settingsChange('菜'.repeat(400_000)) // ≈1.2MB UTF-8
    expect(() => paginateSyncChanges([huge], 100, ONE_MB)).toThrow(PublicError)
    try {
      paginateSyncChanges([huge], 100, ONE_MB)
    } catch (err) {
      expect(err).toBeInstanceOf(PublicError)
      expect((err as PublicError).errCode).toBe('SYNC_CHANGE_TOO_LARGE')
    }
  })

  it('limit 优先于字节上限', () => {
    const small = settingsChange('x')
    const result = paginateSyncChanges([small, small, small], 2, ONE_MB)
    expect(result.page).toHaveLength(2)
    expect(result.truncated).toBe(true)
  })

  it('恰好放满一页不截断', () => {
    const small = settingsChange('x')
    const result = paginateSyncChanges([small, small], 2, ONE_MB)
    expect(result.page).toHaveLength(2)
    expect(result.truncated).toBe(false)
  })

  it('空输入返回空页', () => {
    const result = paginateSyncChanges([], 100, ONE_MB)
    expect(result.page).toHaveLength(0)
    expect(result.truncated).toBe(false)
  })
})
