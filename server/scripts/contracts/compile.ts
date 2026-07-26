#!/usr/bin/env tsx
/**
 * 契约源编译脚本
 *
 * 从 contracts/v1/source/ 生成 contracts/v1/generated/
 */
import { resolve } from 'node:path'
import { compileContractSources } from '../../src/contracts/source-compiler.js'

const rootDir = resolve(import.meta.dirname, '../../..')
const sourceRoot = resolve(rootDir, 'contracts/v1/source')
const outputRoot = resolve(rootDir, 'contracts/v1/generated')

async function main() {
  console.log('Compiling contract sources...')
  console.log('  Source:', sourceRoot)
  console.log('  Output:', outputRoot)

  const manifest = await compileContractSources(sourceRoot, outputRoot)

  console.log('\nGenerated manifest:')
  console.log('  Contract version:', manifest.contractVersion)
  console.log('  Fingerprint:', manifest.fingerprint.slice(0, 16) + '...')
  console.log('  HTTP operations:', manifest.httpOperations.length)
  console.log('  Function tools:', manifest.functionTools.length)
  console.log('  SSE events:', manifest.sseEvents.length)
  console.log('  Schemas:', manifest.schemas.length)
  console.log('  Errors:', manifest.errors.length)
  console.log('  Invariants:', manifest.invariants.length)

  console.log('\n✓ Contract compilation complete')
}

main().catch((err) => {
  console.error('Contract compilation failed:', err)
  process.exit(1)
})
