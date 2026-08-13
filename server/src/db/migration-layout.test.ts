import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { describe, expect, it } from 'vitest'

describe('migration layout', () => {
  it('exposes the deterministic v0.1 contract-persistence migration to the runtime migrator', () => {
    const migrationsFolder = fileURLToPath(new URL('./migrations/', import.meta.url))

    expect(readMigrationFiles({ migrationsFolder })).toMatchObject([
      { folderMillis: 1_785_024_000_000, bps: true },
    ])
  })

  it('persists the conversation envelope and rejects non-positive server versions in SQL', async () => {
    const migration = await readFile(
      fileURLToPath(new URL('./migrations/0000_v01_contract_persistence.sql', import.meta.url)),
      'utf8',
    )

    expect(migration).toMatch(/jsonb_typeof\("conversations"\."messages" -> 'messages'\) = 'array'/)
    expect(migration).toMatch(
      /"recipes_server_version_positive_check" CHECK \("recipes"\."server_version" >= 1\)/,
    )
    expect(migration).toMatch(
      /"weekly_plans_server_version_positive_check" CHECK \("weekly_plans"\."server_version" >= 1\)/,
    )
    expect(migration).toMatch(
      /"settings_server_version_positive_check" CHECK \("settings"\."server_version" >= 1\)/,
    )
    expect(migration).toMatch(
      /"sync_changes_server_version_positive_check" CHECK \("sync_changes"\."server_version" >= 1\)/,
    )
  })

  it('keeps security hashes, confirmation timing, and fencing values constrained in SQL', async () => {
    const migration = await readFile(
      fileURLToPath(new URL('./migrations/0000_v01_contract_persistence.sql', import.meta.url)),
      'utf8',
    )

    expect(migration).not.toContain('bootstrap_secret_hash')
    expect(migration).toContain('auth_config_family_code_hash_format_check')
    expect(migration).toContain('auth_config_family_code_version_check')
    expect(migration).toContain('device_tokens_token_hash_format_check')
    expect(migration).toContain('pending_confirmations_token_hash_format_check')
    expect(migration).toContain('chat_request_receipts_lease_generation_check')
    expect(migration).toContain('chat_request_receipts_lease_check')
    expect(migration).toContain('pending_confirmations_commit_pair_check')
    expect(migration).toContain('sync_changes_resource_id_version_idx')
    expect(migration).toMatch(
      /"pending_confirmations"\."expires_at" >= "pending_confirmations"\."created_at" AND "pending_confirmations"\."expires_at" <= "pending_confirmations"\."created_at" \+ interval '10 minutes'/,
    )
    expect(migration).toContain("~ '^\\$argon2id\\$v=19\\$m=")
    expect(migration).toContain("~ '^[0-9a-f]{64}$'")
    expect(migration).not.toContain('$1')
  })
})
