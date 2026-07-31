import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateMigrationInto, migrationTag } from './generate-migration.js'

const artifactFiles = [
  `${migrationTag}.sql`,
  'meta/_journal.json',
  'meta/0000_snapshot.json',
] as const

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

/** Compare a candidate artifact directory with the committed canonical files. */
export async function checkMigrationArtifacts(candidateFolder: string): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url))
  const committedFolder = resolve(here, '../../src/db/migrations')
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
