#!/usr/bin/env tsx
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type FinalGateFixtureEntry,
  findNonSyntheticCredential,
  validateFixtureCorpus,
} from '../../src/contracts/final-gate-guards.js'
import {
  compileContractSources,
  generateStandaloneValidators,
  generateTypeScriptCatalog,
  generateTypeScriptSchemas,
} from '../../src/contracts/source-compiler.js'
import { compareDirectoryTrees } from '../../src/contracts/test-utils.js'

const rootDir = resolve(import.meta.dirname, '../../..')
const sourceRoot = join(rootDir, 'contracts/v1/source')
const committedContractRoot = join(rootDir, 'contracts/v1/generated')
const committedServerRoot = join(rootDir, 'server/src/contracts/generated')
const committedAndroidRoot = join(
  rootDir,
  'app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/contract/generated',
)
const fixturesRoot = join(rootDir, 'contracts/v1/fixtures')
const fingerprintPattern = /^[a-f0-9]{64}$/

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function listDataFiles(directory: string, base = ''): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...(await listDataFiles(join(directory, entry.name), path)))
    if (entry.isFile() && (entry.name.endsWith('.json') || entry.name.endsWith('.jsonl'))) {
      files.push(path)
    }
  }
  return files
}

async function listFiles(directory: string, base = ''): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...(await listFiles(join(directory, entry.name), path)))
    if (entry.isFile()) files.push(path)
  }
  return files
}

async function loadFixtureEntries(paths: readonly string[]): Promise<FinalGateFixtureEntry[]> {
  const entries: FinalGateFixtureEntry[] = []
  for (const path of paths) {
    const body = await readFile(join(fixturesRoot, path), 'utf8')
    if (path.endsWith('.jsonl')) {
      entries.push(
        ...body
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line) as FinalGateFixtureEntry),
      )
    } else {
      entries.push(JSON.parse(body) as FinalGateFixtureEntry)
    }
  }
  return entries
}

async function verifyFixtureCorpus(manifest: Awaited<ReturnType<typeof compileContractSources>>) {
  const fixtureManifest = JSON.parse(
    await readFile(join(fixturesRoot, 'manifest.json'), 'utf8'),
  ) as { contractVersion?: unknown; syntheticSecret?: unknown; files?: unknown }
  invariant(fixtureManifest.contractVersion === 'v1', 'Fixture manifest must target contract v1')
  invariant(
    fixtureManifest.syntheticSecret === true,
    'Fixture manifest must mark secrets synthetic',
  )
  invariant(Array.isArray(fixtureManifest.files), 'Fixture manifest files must be an array')

  const declaredFiles = fixtureManifest.files as string[]
  invariant(
    new Set(declaredFiles).size === declaredFiles.length,
    'Fixture manifest has duplicate files',
  )
  const actualFiles = (await listDataFiles(fixturesRoot)).filter((path) => path !== 'manifest.json')
  invariant(
    JSON.stringify([...declaredFiles].sort()) === JSON.stringify(actualFiles),
    'Fixture manifest must list every and only corpus data file',
  )

  validateFixtureCorpus(await loadFixtureEntries(declaredFiles), manifest)
}

async function verifyFrozenRecord(fingerprint: string) {
  const frozen = await readFile(join(rootDir, 'contracts/v1/FROZEN.md'), 'utf8')
  const match = frozen.match(/Manifest fingerprint:\s*`([a-f0-9]{64})`/)
  invariant(match?.[1] === fingerprint, 'FROZEN.md fingerprint does not match generated manifest')
  invariant(
    /create\s+a\s+new\s+contract\s+version/i.test(frozen),
    'FROZEN.md must require a new version for wire-shape changes',
  )
}

async function verifyCredentialPatternScan() {
  const credentialPatterns = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bsk-[A-Za-z0-9_-]{16,}\b/,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
    /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/,
    /\bAKIA[A-Z0-9]{16}\b/,
  ]
  for (const directory of [
    fixturesRoot,
    committedContractRoot,
    committedServerRoot,
    committedAndroidRoot,
  ]) {
    for (const path of await listFiles(directory)) {
      const content = await readFile(join(directory, path), 'utf8')
      const keyedCredential = findNonSyntheticCredential(content)
      invariant(
        keyedCredential === null,
        `Contract artifact contains a non-synthetic credential: ${relative(rootDir, join(directory, path))}`,
      )
      for (const pattern of credentialPatterns) {
        invariant(
          !pattern.test(content),
          `Contract artifact contains a credential pattern: ${relative(rootDir, join(directory, path))}`,
        )
      }
    }
  }
}

async function verifyDocs() {
  const [roadmap, release] = await Promise.all([
    readFile(join(rootDir, 'docs/roadmap.md'), 'utf8'),
    readFile(join(rootDir, 'docs/active/0.1.0/release.md'), 'utf8'),
  ])
  invariant(
    /\| 1\. 契约与持久化 .*\| 已完成：v1 契约已冻结/.test(roadmap),
    'Roadmap does not mark stage 1 complete and frozen',
  )
  invariant(
    /contracts-persistence[^\n]*阶段 1 已完成，v1 已冻结/.test(release),
    'Release record does not mark contracts-persistence complete and frozen',
  )
  invariant(
    !/阶段 2[^\n]*已开始/.test(roadmap) && !/阶段 2[^\n]*已开始/.test(release),
    'Stage 2 must not be marked started by the stage 1 gate',
  )
}

async function verifyGeneratedTrees() {
  const first = await mkdtemp(join(tmpdir(), 'mealmate-final-gate-first-'))
  const second = await mkdtemp(join(tmpdir(), 'mealmate-final-gate-second-'))
  try {
    const firstContract = join(first, 'contract')
    const secondContract = join(second, 'contract')
    const firstServer = join(first, 'server')
    const secondServer = join(second, 'server')
    const firstManifest = await compileContractSources(sourceRoot, firstContract)
    const secondManifest = await compileContractSources(sourceRoot, secondContract)
    await Promise.all([mkdir(firstServer), mkdir(secondServer)])
    await Promise.all([
      generateTypeScriptSchemas(
        join(sourceRoot, 'schemas'),
        join(firstServer, 'schemas.ts'),
        firstManifest,
      ),
      generateStandaloneValidators(join(sourceRoot, 'schemas'), join(firstServer, 'validators.ts')),
      generateTypeScriptCatalog(join(firstServer, 'catalogs.ts')),
      generateTypeScriptSchemas(
        join(sourceRoot, 'schemas'),
        join(secondServer, 'schemas.ts'),
        secondManifest,
      ),
      generateStandaloneValidators(
        join(sourceRoot, 'schemas'),
        join(secondServer, 'validators.ts'),
      ),
      generateTypeScriptCatalog(join(secondServer, 'catalogs.ts')),
    ])

    invariant(
      firstManifest.fingerprint === secondManifest.fingerprint,
      'Generation fingerprints differ',
    )
    invariant(
      fingerprintPattern.test(firstManifest.fingerprint),
      'Manifest fingerprint is not SHA-256',
    )
    invariant(
      firstManifest.httpOperations.length === 21,
      'Manifest must contain 21 HTTP operations',
    )
    invariant(firstManifest.functionTools.length === 8, 'Manifest must contain 8 function tools')
    invariant(firstManifest.sseEvents.length === 6, 'Manifest must contain 6 SSE events')

    for (const [left, right, label] of [
      [firstContract, secondContract, 'two contract generations'],
      [firstServer, secondServer, 'two Server generations'],
      [firstContract, committedContractRoot, 'committed contract generation'],
      [firstServer, committedServerRoot, 'committed Server generation'],
    ] as const) {
      const comparison = await compareDirectoryTrees(left, right)
      const relevantDifferences = comparison.differences.filter(
        (difference) => relative(right, join(right, difference.path)) !== '.gitkeep',
      )
      invariant(
        relevantDifferences.length === 0,
        `${label} differs: ${relevantDifferences.map((difference) => difference.path).join(', ')}`,
      )
    }

    await Promise.all([
      verifyFixtureCorpus(firstManifest),
      verifyCredentialPatternScan(),
      verifyFrozenRecord(firstManifest.fingerprint),
      verifyDocs(),
    ])
    return firstManifest.fingerprint
  } finally {
    await Promise.all([
      rm(first, { recursive: true, force: true }),
      rm(second, { recursive: true, force: true }),
    ])
  }
}

async function main() {
  const fingerprint = await verifyGeneratedTrees()
  console.log(`Contract v1 final gate passed (${fingerprint})`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error('Contract v1 final gate failed:', error)
    process.exit(1)
  })
}
