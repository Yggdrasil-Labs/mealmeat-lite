import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('checkMigrationArtifacts', () => {
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
