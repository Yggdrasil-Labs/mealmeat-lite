#!/usr/bin/env tsx
/**
 * 契约源编译脚本
 *
 * 从 contracts/v1/source/ 生成：
 * 1. contracts/v1/generated/ - JSON 文件（manifest.json、protocol-catalog.json、provider-tools.json）
 * 2. server/src/contracts/generated/schemas.ts - TypeScript schema 常量和类型
 * 3. server/src/contracts/generated/validators.ts - Ajv standalone validators
 */
import { resolve } from 'node:path'
import {
  compileContractSources,
  generateStandaloneValidators,
  generateTypeScriptCatalog,
  generateTypeScriptSchemas,
} from '../../src/contracts/source-compiler.js'

const rootDir = resolve(import.meta.dirname, '../../..')
const sourceRoot = resolve(rootDir, 'contracts/v1/source')
const outputRoot = resolve(rootDir, 'contracts/v1/generated')
const schemasDir = resolve(sourceRoot, 'schemas')
const typesOutputPath = resolve(import.meta.dirname, '../../src/contracts/generated/schemas.ts')
const validatorsOutputPath = resolve(
  import.meta.dirname,
  '../../src/contracts/generated/validators.ts',
)
const catalogsOutputPath = resolve(import.meta.dirname, '../../src/contracts/generated/catalogs.ts')

async function main() {
  console.log('Compiling contract sources...')
  console.log('  Source:', sourceRoot)
  console.log('  Output:', outputRoot)

  const manifest = await compileContractSources(sourceRoot, outputRoot)

  console.log('\nGenerated JSON:')
  console.log('  Contract version:', manifest.contractVersion)
  console.log('  Fingerprint:', `${manifest.fingerprint.slice(0, 16)}...`)
  console.log('  HTTP operations:', manifest.httpOperations.length)
  console.log('  Function tools:', manifest.functionTools.length)
  console.log('  SSE events:', manifest.sseEvents.length)
  console.log('  Schemas:', manifest.schemas.length)
  console.log('  Errors:', manifest.errors.length)
  console.log('  Invariants:', manifest.invariants.length)
  console.log('  Provider tools: 8')

  // 生成 TypeScript schema 常量和类型
  console.log('\nGenerating TypeScript schemas...')
  console.log('  Output:', typesOutputPath)
  await generateTypeScriptSchemas(schemasDir, typesOutputPath, manifest)
  console.log('  ✓ schemas.ts generated')

  // 生成 Ajv standalone validators
  console.log('\nGenerating Ajv standalone validators...')
  console.log('  Output:', validatorsOutputPath)
  await generateStandaloneValidators(schemasDir, validatorsOutputPath)
  console.log('  ✓ validators.ts generated')

  await generateTypeScriptCatalog(catalogsOutputPath)
  console.log('  ✓ catalogs.ts generated')

  console.log('\n✓ Contract compilation complete')
}

main().catch((err) => {
  console.error('Contract compilation failed:', err)
  process.exit(1)
})
