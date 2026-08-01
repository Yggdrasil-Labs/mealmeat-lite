import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, readlink, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const migrationTag = '0000_v01_contract_persistence'
export const journalWhen = '2026-07-26T00:00:00.000Z'
const migrationFiles = [
  `${migrationTag}.sql`,
  'meta/_journal.json',
  'meta/0000_snapshot.json',
  'migration-lock.json',
] as const

const migrationLock = {
  tag: migrationTag,
  journalWhen,
} as const

const weeklyPlanIntegritySql = `
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "assert_weekly_plan_slots"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_plan_id uuid;
  target_week_start date;
BEGIN
  IF TG_TABLE_NAME = 'weekly_plans' THEN
    target_plan_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    SELECT week_start INTO target_week_start FROM weekly_plans WHERE id = target_plan_id;
    IF NOT FOUND THEN
      RETURN NULL;
    END IF;
    IF (SELECT count(*) FROM plan_items WHERE weekly_plan_id = target_plan_id) <> 21
      OR EXISTS (
        SELECT 1 FROM plan_items
        WHERE weekly_plan_id = target_plan_id
          AND (date < target_week_start OR date >= target_week_start + 7)
      ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'weekly_plans_complete_slots_check',
        MESSAGE = 'weekly plan must contain exactly 21 in-week meal slots';
    END IF;
  ELSE
    FOR target_plan_id IN
      SELECT DISTINCT candidate.plan_id
      FROM unnest(
        CASE
          WHEN TG_OP = 'UPDATE' THEN ARRAY[OLD.weekly_plan_id, NEW.weekly_plan_id]
          WHEN TG_OP = 'DELETE' THEN ARRAY[OLD.weekly_plan_id]
          ELSE ARRAY[NEW.weekly_plan_id]
        END
      ) AS candidate(plan_id)
    LOOP
      SELECT week_start INTO target_week_start FROM weekly_plans WHERE id = target_plan_id;
      IF NOT FOUND THEN
        CONTINUE;
      END IF;
      IF (SELECT count(*) FROM plan_items WHERE weekly_plan_id = target_plan_id) <> 21
        OR EXISTS (
          SELECT 1 FROM plan_items
          WHERE weekly_plan_id = target_plan_id
            AND (date < target_week_start OR date >= target_week_start + 7)
        ) THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          CONSTRAINT = 'weekly_plans_complete_slots_check',
          MESSAGE = 'weekly plan must contain exactly 21 in-week meal slots';
      END IF;
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "weekly_plans_complete_slots_check"
AFTER INSERT OR UPDATE OR DELETE ON "weekly_plans"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_weekly_plan_slots"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "plan_items_weekly_plan_range_check"
AFTER INSERT OR UPDATE OR DELETE ON "plan_items"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_weekly_plan_slots"();
`

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

async function releaseDigest(folder: string): Promise<string> {
  const hash = createHash('sha256')
  for (const file of migrationFiles) {
    hash.update(file).update('\0').update(await readFile(join(folder, file))).update('\0')
  }
  return hash.digest('hex').slice(0, 16)
}

async function hasSameArtifacts(left: string, right: string): Promise<boolean> {
  for (const file of migrationFiles) {
    const [leftBytes, rightBytes] = await Promise.all([
      readFile(join(left, file)),
      readFile(join(right, file)),
    ])
    if (!leftBytes.equals(rightBytes)) return false
  }
  return true
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
  const withSequence = generatedSql.startsWith(sequence) ? generatedSql : `${sequence}${generatedSql}`
  await writeFile(
    sqlPath,
    withSequence.includes('CREATE OR REPLACE FUNCTION "assert_weekly_plan_slots"')
      ? withSequence
      : `${withSequence}${weeklyPlanIntegritySql}`,
    'utf8',
  )
  await writeFile(
    join(folder, 'migration-lock.json'),
    `${JSON.stringify(migrationLock, null, 2)}\n`,
    'utf8',
  )
}

export interface MigrationPublishHooks {
  /** Test-only seam invoked after a release is complete and before the stable pointer changes. */
  beforeCommit?(): void | Promise<void>
}

/**
 * Publishes a complete, immutable migration release by atomically replacing the
 * stable `migrations` symlink. Consumers must resolve that symlink once before
 * handing the physical path to Drizzle, so a single migration run never spans
 * two releases.
 */
export async function synchroniseMigrationArtifactsAtomically(
  targetFolder: string,
  generatedFolder: string,
  hooks: MigrationPublishHooks = {},
): Promise<void> {
  const parent = dirname(targetFolder)
  const base = basename(targetFolder)
  const releasesRoot = join(parent, `.${base}-releases`)
  const stablePointer = await readlink(targetFolder).catch(() => undefined)
  if (stablePointer === undefined) {
    throw new Error(`Migration target must be a stable symlink: ${targetFolder}`)
  }
  await mkdir(releasesRoot, { recursive: true })
  const publishRoot = await mkdtemp(join(releasesRoot, '.publish-'))
  const replacement = join(publishRoot, base)
  const previousRelease = await realpath(targetFolder)
  try {
    await cp(previousRelease, replacement, { recursive: true })
    for (const file of migrationFiles) {
      await cp(join(generatedFolder, file), join(replacement, file), { force: true })
    }
    await hooks.beforeCommit?.()

    const release = join(releasesRoot, `${migrationTag}-${await releaseDigest(replacement)}`)
    try {
      await rename(replacement, release)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (!(await hasSameArtifacts(replacement, release))) {
        throw new Error(`Migration release digest collision: ${release}`)
      }
      await rm(replacement, { recursive: true, force: true })
    }
    const nextPointer = join(parent, `.${base}.next-${process.pid}-${Date.now()}`)
    await symlink(join(`.${base}-releases`, basename(release)), nextPointer)
    await rename(nextPointer, targetFolder)
  } finally {
    await rm(publishRoot, { recursive: true, force: true })
  }
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
    const stablePointer = await readlink(targetFolder).catch(() => undefined)
    if (stablePointer === undefined) {
      for (const file of migrationFiles) {
        await cp(join(staging, file), join(targetFolder, file), { force: true })
      }
    } else {
      await synchroniseMigrationArtifactsAtomically(targetFolder, staging)
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
