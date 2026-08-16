/**
 * 同步分页纯函数 — limit 与 UTF-8 字节上限双重截断
 *
 * 冻结契约的「1 MB 页」按 wire 实际传输的 UTF-8 字节度量，而非 JS 字符串长度
 * （UTF-16 code unit）：中文内容 1 字 = 1 unit = 3 字节，按 unit 度量会超上限约 3 倍。
 */
import type { SyncChangeDto } from '../../contracts/generated/schemas.js'
import { PublicError } from '../../errors.js'

export interface PagedSyncChanges {
  page: SyncChangeDto[]
  truncated: boolean
}

export function paginateSyncChanges(
  changes: SyncChangeDto[],
  limit: number,
  byteLimit: number,
): PagedSyncChanges {
  const page: SyncChangeDto[] = []
  let bytes = 0
  for (const change of changes) {
    const size = Buffer.byteLength(JSON.stringify(change), 'utf8')
    if (page.length > 0 && bytes + size > byteLimit) return { page, truncated: true }
    if (page.length === 0 && size > byteLimit) {
      throw new PublicError('SYNC_CHANGE_TOO_LARGE')
    }
    if (page.length >= limit) return { page, truncated: true }
    page.push(change)
    bytes += size
  }
  return { page, truncated: false }
}
