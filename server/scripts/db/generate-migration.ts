import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const migrationTag = '0000_v01_contract_persistence'
export const journalWhen = '2026-07-26T00:00:00.000Z'
const migrationFiles = [
  `${migrationTag}.sql`,
  'meta/_journal.json',
  'meta/0000_snapshot.json',
] as const

function stableSnapshotId(snapshot: Record<string, unknown>): string {
  const { id: _id, prevId: _prevId, ...content } = snapshot
  const hash = createHash('sha256')
    .update(JSON.stringify(sortJson(content)))
    .digest()
    .subarray(0, 16)
  const byte6 = hash.at(6)
  const byte8 = hash.at(8)
  if (byte6 === undefined || byte8 === undefined)
    throw new Error('SHA-256 digest was unexpectedly short')
  hash[6] = (byte6 & 0x0f) | 0x80
  hash[8] = (byte8 & 0x3f) | 0x80
  const hex = hash.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJson(child)]),
    )
  }
  return value
}

export async function normaliseMigrationArtifacts(folder: string): Promise<void> {
  const journalPath = join(folder, 'meta', '_journal.json')
  const snapshotPath = join(folder, 'meta', '0000_snapshot.json')
  const journal = JSON.parse(await readFile(journalPath, 'utf8')) as {
    entries: Array<Record<string, unknown>>
  }
  const entry = journal.entries.find((candidate) => candidate.tag === migrationTag)
  if (!entry) throw new Error(`Generated journal does not contain ${migrationTag}`)
  entry.when = Date.parse(journalWhen)

  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as Record<string, unknown>
  snapshot.prevId = ''
  snapshot.id = stableSnapshotId(snapshot)

  await writeFile(journalPath, `${JSON.stringify(sortJson(journal), null, 2)}\n`, 'utf8')
  await writeFile(snapshotPath, `${JSON.stringify(sortJson(snapshot), null, 2)}\n`, 'utf8')
  execFileSync(
    resolve(process.cwd(), 'node_modules/.bin/biome'),
    ['format', '--write', '--config-path', resolve(process.cwd(), '..'), journalPath, snapshotPath],
    { stdio: 'inherit', env: process.env },
  )

  const sqlPath = join(folder, `${migrationTag}.sql`)
  const generatedSql = await readFile(sqlPath, 'utf8')
  const sequence =
    'CREATE SEQUENCE "sync_server_version_seq" AS bigint START WITH 1 INCREMENT BY 1;\n--> statement-breakpoint\n'
  await writeFile(
    sqlPath,
    generatedSql.startsWith(sequence) ? generatedSql : `${sequence}${generatedSql}`,
    'utf8',
  )
}

export async function generateMigrationInto(targetFolder: string): Promise<void> {
  const staging = await mkdtemp(join(tmpdir(), 'mealmate-v01-migration-'))
  try {
    execFileSync(
      resolve(process.cwd(), 'node_modules/.bin/drizzle-kit'),
      [
        'generate',
        '--dialect',
        'postgresql',
        '--schema',
        resolve(process.cwd(), 'src/db/schema/index.ts'),
        '--out',
        staging,
        '--name',
        'v01_contract_persistence',
      ],
      { stdio: 'inherit', env: process.env },
    )
    await normaliseMigrationArtifacts(staging)
    for (const file of migrationFiles) {
      const source = join(staging, file)
      const destination = join(targetFolder, file)
      await cp(source, destination, { force: true })
    }
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url))
  await generateMigrationInto(resolve(here, '../../src/db/migrations'))
}

if (process.argv[1] && basename(process.argv[1]) === 'generate-migration.ts') {
  await main()
}
