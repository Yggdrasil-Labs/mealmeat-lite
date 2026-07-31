import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateMigrationInto, migrationTag } from './generate-migration.js'

const artifactFiles = [
  `${migrationTag}.sql`,
  'meta/_journal.json',
  'meta/0000_snapshot.json',
  'migration-lock.json',
] as const

const expectedJournalWhen = Date.parse('2026-07-26T00:00:00.000Z')

export class MigrationArtifactMismatchError extends Error {
  readonly changedPath: string

  constructor(changedPath: string) {
    super(`Migration artifact differs: ${changedPath}`)
    this.changedPath = changedPath
  }
}

async function equalFile(left: string, right: string): Promise<boolean> {
  const [leftBytes, rightBytes] = await Promise.all([readFile(left), readFile(right)])
  return (
    createHash('sha256').update(leftBytes).digest('hex') ===
    createHash('sha256').update(rightBytes).digest('hex')
  )
}

async function generatedArtifactPaths(folder: string): Promise<readonly string[]> {
  const [rootEntries, metaEntries] = await Promise.all([
    readdir(folder, { withFileTypes: true }),
    readdir(join(folder, 'meta'), { withFileTypes: true }),
  ])
  return [
    ...rootEntries
      .filter((entry) => entry.isFile() && (entry.name.endsWith('.sql') || entry.name === 'migration-lock.json'))
      .map((entry) => entry.name),
    ...metaEntries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => `meta/${entry.name}`),
  ].sort()
}

async function assertMigrationMetadata(folder: string): Promise<void> {
  const [journalRaw, lockRaw] = await Promise.all([
    readFile(join(folder, 'meta/_journal.json'), 'utf8'),
    readFile(join(folder, 'migration-lock.json'), 'utf8'),
  ])
  const journal = JSON.parse(journalRaw) as {
    entries?: Array<{ tag?: unknown; when?: unknown }>
  }
  const lock = JSON.parse(lockRaw) as { tag?: unknown; journalWhen?: unknown }
  const entry = journal.entries?.[0]
  if (
    journal.entries?.length !== 1 ||
    entry?.tag !== migrationTag ||
    entry.when !== expectedJournalWhen
  ) {
    throw new MigrationArtifactMismatchError('meta/_journal.json')
  }
  if (
    lock.tag !== migrationTag ||
    lock.journalWhen !== '2026-07-26T00:00:00.000Z'
  ) {
    throw new MigrationArtifactMismatchError('migration-lock.json')
  }
}

/** Compare a candidate artifact directory with the committed canonical files. */
export async function checkMigrationArtifacts(candidateFolder: string): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url))
  const committedFolder = resolve(here, '../../src/db/migrations')
  const [candidatePaths, committedPaths] = await Promise.all([
    generatedArtifactPaths(candidateFolder),
    generatedArtifactPaths(committedFolder),
  ])
  const expectedPaths = [...artifactFiles].sort()
  for (const [paths, source] of [
    [candidatePaths, candidateFolder],
    [committedPaths, committedFolder],
  ] as const) {
    const mismatch = paths.find((path, index) => path !== expectedPaths[index])
    if (mismatch || paths.length !== expectedPaths.length) {
      throw new MigrationArtifactMismatchError(
        mismatch ?? paths.at(-1) ?? `unexpected:${source}`,
      )
    }
  }
  await Promise.all([assertMigrationMetadata(candidateFolder), assertMigrationMetadata(committedFolder)])
  for (const file of artifactFiles) {
    if (!(await equalFile(join(candidateFolder, file), join(committedFolder, file)))) {
      throw new MigrationArtifactMismatchError(file)
    }
  }
}

export async function checkMigrations(): Promise<void> {
  const first = await mkdtemp(join(tmpdir(), 'mealmate-migrations-first-'))
  const second = await mkdtemp(join(tmpdir(), 'mealmate-migrations-second-'))
  try {
    await generateMigrationInto(first)
    await generateMigrationInto(second)
    for (const file of artifactFiles) {
      if (!(await equalFile(join(first, file), join(second, file)))) {
        throw new MigrationArtifactMismatchError(file)
      }
    }
    await checkMigrationArtifacts(first)
  } finally {
    await Promise.all([
      rm(first, { recursive: true, force: true }),
      rm(second, { recursive: true, force: true }),
    ])
  }
}

if (process.argv[1] && basename(process.argv[1]) === 'check-migrations.ts') {
  await checkMigrations()
}
