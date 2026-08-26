import { spawnSync } from 'node:child_process'
import postgres from 'postgres'
import { describe, expect, it } from 'vitest'
import { unwrapPostgresError } from './postgres-error.js'

describe('unwrapPostgresError', () => {
  it('loads with Node native ESM resolution', () => {
    const moduleUrl = new URL('./postgres-error.ts', import.meta.url).href
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', `await import(${JSON.stringify(moduleUrl)})`],
      { encoding: 'utf8' },
    )

    expect(result.status, result.stderr).toBe(0)
  })

  it('recognizes a postgres.js error directly', () => {
    const error = new postgres.PostgresError('database unavailable')

    expect(unwrapPostgresError(error)).toBe(error)
  })

  it('recognizes a postgres.js error wrapped as a cause', () => {
    const cause = new postgres.PostgresError('database unavailable')

    expect(unwrapPostgresError({ cause })).toBe(cause)
  })
})
