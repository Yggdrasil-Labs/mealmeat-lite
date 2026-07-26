#!/usr/bin/env tsx
/**
 * 契约生成物检查脚本
 *
 * 验证已提交的 contracts/v1/generated/ 与源一致
 */
import { resolve } from 'node:path'
import { checkGeneratedContract } from '../../src/contracts/source-compiler.js'

const rootDir = resolve(import.meta.dirname, '../../..')
const sourceRoot = resolve(rootDir, 'contracts/v1/source')
const outputRoot = resolve(rootDir, 'contracts/v1/generated')

async function main() {
  console.log('Checking generated contracts...')
  console.log('  Source:', sourceRoot)
  console.log('  Committed:', outputRoot)

  const diff = await checkGeneratedContract(sourceRoot, outputRoot)

  if (!diff.hasChanges) {
    console.log('\n✓ Generated contracts are up to date')
    return
  }

  console.error('\n✗ Generated contracts are out of sync:')

  if (diff.added.length > 0) {
    console.error('\n  Added (need to commit):')
    for (const file of diff.added) {
      console.error(`    + ${file}`)
    }
  }

  if (diff.modified.length > 0) {
    console.error('\n  Modified (need to regenerate):')
    for (const file of diff.modified) {
      console.error(`    ~ ${file}`)
    }
  }

  if (diff.deleted.length > 0) {
    console.error('\n  Stale (need to delete):')
    for (const file of diff.deleted) {
      console.error(`    - ${file}`)
    }
  }

  console.error('\nRun `pnpm contract:generate` to update.')
  process.exit(1)
}

main().catch((err) => {
  console.error('Contract check failed:', err)
  process.exit(1)
})
