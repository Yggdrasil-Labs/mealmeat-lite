/**
 * 契约测试工具函数
 */
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface DirectoryComparison {
  identical: boolean
  differences: DirectoryDifference[]
}

export interface DirectoryDifference {
  path: string
  type: 'added' | 'removed' | 'modified'
  reason?: string
}

/**
 * 递归比较两个目录树
 * 比较文件路径和字节内容
 */
export async function compareDirectoryTrees(
  dir1: string,
  dir2: string,
): Promise<DirectoryComparison> {
  const files1 = await collectFiles(dir1)
  const files2 = await collectFiles(dir2)

  const differences: DirectoryDifference[] = []

  // 检查 dir1 中的文件
  for (const [relativePath, hash1] of files1) {
    const hash2 = files2.get(relativePath)
    if (hash2 === undefined) {
      differences.push({ path: relativePath, type: 'removed' })
    } else if (hash1 !== hash2) {
      differences.push({ path: relativePath, type: 'modified', reason: 'content differs' })
    }
  }

  // 检查 dir2 中新增的文件
  for (const [relativePath] of files2) {
    if (!files1.has(relativePath)) {
      differences.push({ path: relativePath, type: 'added' })
    }
  }

  return {
    identical: differences.length === 0,
    differences,
  }
}

/**
 * 递归收集目录中所有文件及其 SHA-256 哈希
 */
async function collectFiles(dir: string, basePath = ''): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const entries = await readdir(dir, { withFileTypes: true })

  // 按字典序排序
  entries.sort((a, b) => a.name.localeCompare(b.name))

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      const subFiles = await collectFiles(fullPath, relativePath)
      for (const [subPath, hash] of subFiles) {
        result.set(subPath, hash)
      }
    } else if (entry.isFile()) {
      const content = await readFile(fullPath)
      const hash = createHash('sha256').update(content).digest('hex')
      result.set(relativePath, hash)
    }
  }

  return result
}

/**
 * 计算目录树的 fingerprint
 * 使用 UTF-8/LF 规范化，文件按相对路径字典序
 */
export async function calculateDirectoryFingerprint(dir: string): Promise<string> {
  const files = await collectFiles(dir)

  // 按路径字典序排序
  const sortedPaths = Array.from(files.keys()).sort()

  // 组合所有哈希
  const combined = createHash('sha256')
  for (const path of sortedPaths) {
    combined.update(path)
    const hash = files.get(path)
    if (hash) combined.update(hash)
  }

  return combined.digest('hex')
}
