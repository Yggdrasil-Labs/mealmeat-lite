import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('checkMigrationArtifacts', () => {
  it('rejects a journal whose tag or epoch no longer matches the migration lock', async () => {
    const modulePath = '../../../scripts/db/check-migrations.js'
    const { checkMigrationArtifacts } = await import(modulePath)
    const fixture = await mkdtemp(join(tmpdir(), 'mealmate-migration-journal-check-'))
    try {
      await cp(new URL('../../db/migrations/', import.meta.url), fixture, { recursive: true })
      const journalPath = join(fixture, 'meta', '_journal.json')
      const journal = JSON.parse(await readFile(journalPath, 'utf8')) as {
        entries: Array<Record<string, unknown>>
      }
      journal.entries[0] = { ...journal.entries[0], when: 0 }
      await writeFile(journalPath, `${JSON.stringify(journal)}\n`, 'utf8')
      await expect(checkMigrationArtifacts(fixture)).rejects.toMatchObject({
        changedPath: 'meta/_journal.json',
      })
    } finally {
      await rm(fixture, { recursive: true, force: true })
    }
  })

  it('rejects a tampered migration lock with its exact path', async () => {
    const modulePath = '../../../scripts/db/check-migrations.js'
    const { checkMigrationArtifacts } = await import(modulePath)
    const fixture = await mkdtemp(join(tmpdir(), 'mealmate-migration-lock-check-'))
    try {
      await cp(new URL('../../db/migrations/', import.meta.url), fixture, { recursive: true })
      await writeFile(
        join(fixture, 'migration-lock.json'),
        '{"tag":"unexpected","journalWhen":"2026-07-26T00:00:00.000Z"}\n',
        'utf8',
      )
      await expect(checkMigrationArtifacts(fixture)).rejects.toMatchObject({
        changedPath: 'migration-lock.json',
      })
    } finally {
      await rm(fixture, { recursive: true, force: true })
    }
  })

  it('rejects an extra generated SQL artifact', async () => {
    const modulePath = '../../../scripts/db/check-migrations.js'
    const { checkMigrationArtifacts } = await import(modulePath)
    const fixture = await mkdtemp(join(tmpdir(), 'mealmate-migration-extra-check-'))
    try {
      await cp(new URL('../../db/migrations/', import.meta.url), fixture, { recursive: true })
      await writeFile(join(fixture, '0001_unexpected.sql'), '-- stale\n', 'utf8')
      await expect(checkMigrationArtifacts(fixture)).rejects.toMatchObject({
        changedPath: '0001_unexpected.sql',
      })
    } finally {
      await rm(fixture, { recursive: true, force: true })
    }
  })

  it('does not partially publish generated artifacts when staging fails before the atomic swap', async () => {
    const modulePath = '../../../scripts/db/generate-migration.js'
    const { synchroniseMigrationArtifactsAtomically } = await import(modulePath)
    const root = await mkdtemp(join(tmpdir(), 'mealmate-migration-target-'))
    const releases = join(root, '.migrations-releases')
    const previous = join(releases, 'previous')
    const target = join(root, 'migrations')
    const generated = await mkdtemp(join(tmpdir(), 'mealmate-migration-generated-'))
    try {
      const source = new URL('../../db/migrations/', import.meta.url)
      await mkdir(releases, { recursive: true })
      await Promise.all([
        cp(source, previous, { recursive: true }),
        cp(source, generated, { recursive: true }),
      ])
      await symlink('.migrations-releases/previous', target)
      const sqlPath = join(generated, '0000_v01_contract_persistence.sql')
      await writeFile(sqlPath, '-- new generation must never leak\n', 'utf8')
      const before = await readFile(join(target, '0000_v01_contract_persistence.sql'), 'utf8')

      await expect(
        synchroniseMigrationArtifactsAtomically(target, generated, {
          beforeCommit: () => {
            throw new Error('injected copy failure')
          },
        }),
      ).rejects.toThrow('injected copy failure')

      await expect(
        readFile(join(target, '0000_v01_contract_persistence.sql'), 'utf8'),
      ).resolves.toBe(before)
      await expect(readlink(target)).resolves.toBe('.migrations-releases/previous')
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(generated, { recursive: true, force: true }),
      ])
    }
  })

  it('switches a stable migration pointer without invalidating a reader that already resolved it', async () => {
    const modulePath = '../../../scripts/db/generate-migration.js'
    const { synchroniseMigrationArtifactsAtomically } = await import(modulePath)
    const root = await mkdtemp(join(tmpdir(), 'mealmate-migration-pointer-'))
    const releases = join(root, '.migrations-releases')
    const previous = join(releases, 'previous')
    const target = join(root, 'migrations')
    const generated = await mkdtemp(join(tmpdir(), 'mealmate-migration-generated-'))
    try {
      const source = new URL('../../db/migrations/', import.meta.url)
      await mkdir(releases, { recursive: true })
      await Promise.all([
        cp(source, previous, { recursive: true }),
        cp(source, generated, { recursive: true }),
      ])
      await symlink('.migrations-releases/previous', target)
      const pinnedReaderFolder = await realpath(target)
      const previousSql = await readFile(
        join(pinnedReaderFolder, '0000_v01_contract_persistence.sql'),
        'utf8',
      )
      const newJournal = '{"entries":[{"tag":"new-release"}]}\n'
      await writeFile(join(generated, 'meta', '_journal.json'), newJournal, 'utf8')

      await synchroniseMigrationArtifactsAtomically(target, generated)

      await expect(
        readFile(join(pinnedReaderFolder, '0000_v01_contract_persistence.sql'), 'utf8'),
      ).resolves.toBe(previousSql)
      await expect(
        readFile(join(target, '0000_v01_contract_persistence.sql'), 'utf8'),
      ).resolves.toBe(previousSql)
      await expect(readFile(join(target, 'meta', '_journal.json'), 'utf8')).resolves.toBe(
        newJournal,
      )
      await expect(readlink(target)).resolves.toMatch(
        /^\.migrations-releases\/0000_v01_contract_persistence-/,
      )
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(generated, { recursive: true, force: true }),
      ])
    }
  })

  it('reports the precise SQL path when a copied migration is tampered', async () => {
    const modulePath = '../../../scripts/db/check-migrations.js'
    const { checkMigrationArtifacts } = await import(modulePath)
    const fixture = await mkdtemp(join(tmpdir(), 'mealmate-migration-check-'))
    try {
      const source = new URL('../../db/migrations/', import.meta.url)
      await cp(source, fixture, { recursive: true })
      const sqlPath = join(fixture, '0000_v01_contract_persistence.sql')
      await writeFile(sqlPath, `${await readFile(sqlPath, 'utf8')}\n-- tampered\n`, 'utf8')

      await expect(checkMigrationArtifacts(fixture)).rejects.toMatchObject({
        changedPath: '0000_v01_contract_persistence.sql',
      })
    } finally {
      await rm(fixture, { recursive: true, force: true })
    }
  })
})
