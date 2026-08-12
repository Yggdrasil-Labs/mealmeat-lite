import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { validatePublicErrorTuple } from './error-catalog.js'
import { validateInvariant } from './invariants.js'
import { validateSseTrace } from './sse-trace.js'
import type { FunctionToolName } from './types.js'
import { validateContract, validateToolInput } from './validation.js'

const fixturesRoot = resolve(import.meta.dirname, '../../../contracts/v1/fixtures')
type Consumer = 'server' | 'android' | 'postgres' | 'room'
type Category = 'schema' | 'protocol-invariant' | 'error-tuple' | 'trace'
const consumers = new Set<Consumer>(['server', 'android', 'postgres', 'room'])

interface Fixture {
  id: string
  operationId?: string
  toolName?: string
  schemaId: Parameters<typeof validateContract>[0]
  expected: 'accept' | 'reject'
  expectedCategory: Category
  consumers: readonly Consumer[]
  httpStatus?: number
  headers?: Readonly<Record<string, string>>
  value: unknown
}
interface TraceFixture {
  id: string
  expected: 'accept' | 'reject'
  expectedCategory: 'trace'
  consumers: readonly Consumer[]
  frames: Parameters<typeof validateSseTrace>[0]
}

function validateCorpusMetadata(entries: ReadonlyArray<Fixture | TraceFixture>): void {
  const fixtureIds = new Set<string>()
  for (const entry of entries) {
    if (entry.consumers.length === 0) {
      throw new Error(`Fixture ${entry.id} must declare at least one consumer`)
    }
    for (const consumer of entry.consumers) {
      if (!consumers.has(consumer)) {
        throw new Error(`Unknown consumer ${consumer} for fixture ${entry.id}`)
      }
    }
    if (fixtureIds.has(entry.id)) throw new Error(`Duplicate fixture ID: ${entry.id}`)
    fixtureIds.add(entry.id)
  }
}

async function corpus(): Promise<{ fixtures: Fixture[]; traces: TraceFixture[] }> {
  const manifest = JSON.parse(await readFile(resolve(fixturesRoot, 'manifest.json'), 'utf8')) as {
    syntheticSecret: boolean
    files: string[]
  }
  expect(manifest.syntheticSecret).toBe(true)
  const contents = await Promise.all(
    manifest.files.map(async (path) => ({
      path,
      body: await readFile(resolve(fixturesRoot, path), 'utf8'),
    })),
  )
  const result = {
    fixtures: contents
      .filter(({ path }) => path.endsWith('.jsonl'))
      .flatMap(({ body }) =>
        body
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Fixture),
      ),
    traces: contents
      .filter(({ path }) => !path.endsWith('.jsonl'))
      .map(({ body }) => JSON.parse(body) as TraceFixture),
  }
  validateCorpusMetadata([...result.fixtures, ...result.traces])
  return result
}

async function concreteHttpSuccesses(): Promise<
  ReadonlyMap<string, Parameters<typeof validateContract>[0]>
> {
  const manifest = JSON.parse(
    await readFile(resolve(fixturesRoot, '../generated/manifest.json'), 'utf8'),
  ) as {
    httpOperations: Array<{
      operationId: string
      responses: Record<string, Parameters<typeof validateContract>[0] | null>
    }>
  }
  const entries: Array<[string, Parameters<typeof validateContract>[0]]> = []
  for (const operation of manifest.httpOperations) {
    for (const [status, schemaId] of Object.entries(operation.responses)) {
      if (status.startsWith('2') && schemaId !== null) {
        entries.push([operation.operationId, schemaId])
      }
    }
  }
  return new Map(entries)
}

async function functionToolBindings(): Promise<
  ReadonlyMap<string, Parameters<typeof validateContract>[0]>
> {
  const manifest = JSON.parse(
    await readFile(resolve(fixturesRoot, '../generated/manifest.json'), 'utf8'),
  ) as {
    functionTools: Array<{ name: string; inputSchemaId: Parameters<typeof validateContract>[0] }>
  }
  return new Map(manifest.functionTools.map((tool) => [tool.name, tool.inputSchemaId]))
}

async function sseEventNames(): Promise<ReadonlySet<string>> {
  const manifest = JSON.parse(
    await readFile(resolve(fixturesRoot, '../generated/manifest.json'), 'utf8'),
  ) as { sseEvents: Array<{ event: string }> }
  return new Set(manifest.sseEvents.map((event) => event.event))
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

async function reserializeHttpSuccess(value: unknown): Promise<unknown> {
  const app = new Hono()
  app.get('/fixture', (context) => context.json(value))
  const response = await app.request('http://fixture.test/fixture')
  expect(response.headers.get('content-type')).toContain('application/json')
  return response.json()
}

function executeFixture(fixture: Fixture): { accepted: boolean; category: Category } {
  if (fixture.schemaId === 'ErrorResponse') {
    return {
      accepted: validatePublicErrorTuple(
        fixture.httpStatus ?? 0,
        new Headers(fixture.headers),
        fixture.value,
        'json',
      ).success,
      category: 'error-tuple',
    }
  }

  const schema = validateContract(fixture.schemaId, fixture.value)
  if (!schema.success) return { accepted: false, category: 'schema' }

  const change = fixture.value as { resource?: unknown; data?: Record<string, unknown> }
  if (fixture.schemaId === 'SyncChangeDto' && change.resource === 'weekly_plan') {
    const data = change.data
    const invariantValid =
      validateInvariant('WEEK_START_IS_MONDAY', data?.weekStart).success &&
      validateInvariant('WEEKLY_PLAN_HAS_21_SLOTS', data).success
    if (!invariantValid) return { accepted: false, category: 'protocol-invariant' }
  }

  return { accepted: true, category: 'schema' }
}

describe('shared contract fixture corpus', () => {
  it('rejects empty consumer lists and duplicate fixture IDs', () => {
    const base: TraceFixture = {
      id: 'metadata-fixture',
      expected: 'accept',
      expectedCategory: 'trace',
      consumers: ['server'],
      frames: [],
    }
    expect(() => validateCorpusMetadata([{ ...base, consumers: [] }])).toThrow(
      'Fixture metadata-fixture must declare at least one consumer',
    )
    expect(() => validateCorpusMetadata([base, base])).toThrow(
      'Duplicate fixture ID: metadata-fixture',
    )
    expect(() => validateCorpusMetadata([{ ...base, consumers: ['browser' as Consumer] }])).toThrow(
      'Unknown consumer browser for fixture metadata-fixture',
    )
  })

  it('covers every concrete HTTP 2xx response schema from the authoritative manifest', async () => {
    const [{ fixtures }, expected] = await Promise.all([corpus(), concreteHttpSuccesses()])
    const actual = fixtures.filter(
      (entry) => entry.id.startsWith('http-') && entry.expected === 'accept',
    )
    expect(actual.map((entry) => entry.operationId)).toHaveLength(expected.size)
    expect(new Set(actual.map((entry) => entry.operationId))).toEqual(new Set(expected.keys()))
    for (const fixture of actual) {
      if (fixture.operationId === undefined) {
        throw new Error(`HTTP fixture ${fixture.id} has no operationId`)
      }
      expect(fixture.schemaId).toBe(expected.get(fixture.operationId))
    }
  })

  it('covers every authoritative function tool with the shared consumer corpus', async () => {
    const [{ fixtures }, expected] = await Promise.all([corpus(), functionToolBindings()])
    const toolFixtures = fixtures.filter((entry) => entry.toolName !== undefined)
    const acceptedNames = new Set(
      toolFixtures.filter((entry) => entry.expected === 'accept').map((entry) => entry.toolName),
    )
    expect(acceptedNames).toEqual(new Set(expected.keys()))
    for (const fixture of toolFixtures) {
      const toolName = fixture.toolName as FunctionToolName
      expect(fixture.schemaId).toBe(expected.get(toolName))
      expect(validateToolInput(toolName, fixture.value).success).toBe(fixture.expected === 'accept')
      expect(fixture.consumers).toEqual(expect.arrayContaining(['server', 'android']))
    }
  })

  it('keeps the documented function-cardinality boundary vectors in the shared corpus', async () => {
    const { fixtures } = await corpus()
    const byId = new Map(fixtures.map((fixture) => [fixture.id, fixture]))
    const arrayField = (id: string, field: string): unknown[] => {
      const fixture = byId.get(id)
      if (!fixture) throw new Error(`Missing fixture: ${id}`)
      const value = fixture.value as Record<string, unknown>
      if (!Array.isArray(value[field])) throw new Error(`Fixture ${id} has no array field ${field}`)
      return value[field]
    }

    expect(arrayField('tool-batch-generate-recipes-max', 'recipes')).toHaveLength(50)
    expect(arrayField('tool-batch-generate-recipes-over-limit', 'recipes')).toHaveLength(51)
    expect(byId.get('tool-batch-generate-recipes-over-limit')?.expected).toBe('reject')
    expect(arrayField('tool-generate-weekly-plan', 'items')).toHaveLength(21)
    expect(arrayField('tool-generate-weekly-plan-under-limit', 'items')).toHaveLength(20)
    expect(byId.get('tool-generate-weekly-plan-under-limit')?.expected).toBe('reject')
  })

  it('keeps the documented HTTP negative vectors in the shared corpus', async () => {
    const { fixtures } = await corpus()
    const ids = new Set(
      fixtures.filter((fixture) => fixture.id.startsWith('http-')).map((fixture) => fixture.id),
    )
    expect([...ids]).toEqual(
      expect.arrayContaining([
        'http-recipe-unknown-field',
        'http-chat-history-illegal-enum',
        'http-recipe-missing-required',
        'http-sync-result-mutually-exclusive',
      ]),
    )
  })

  it('rejects unknown function tool names at the runtime validation boundary', () => {
    expect(validateToolInput('unknown_tool' as FunctionToolName, {})).toMatchObject({
      success: false,
      code: 'UNKNOWN_TOOL',
      error: 'Unknown function tool: unknown_tool',
    })
  })

  it('covers every authoritative SSE event with accepted shared traces', async () => {
    const [{ traces }, expected] = await Promise.all([corpus(), sseEventNames()])
    const actual = new Set(
      traces
        .filter((trace) => trace.expected === 'accept')
        .flatMap((trace) => trace.frames.map((frame) => frame.event)),
    )
    expect(actual).toEqual(expected)
  })

  it('keeps every documented SSE state-machine violation in the shared corpus', async () => {
    const { traces } = await corpus()
    expect(traces.map((trace) => trace.id)).toEqual(
      expect.arrayContaining([
        'sse-invalid-missing-start',
        'sse-invalid-non-increasing-event-id',
        'sse-invalid-tool-terminal-before-start',
        'sse-invalid-after-terminal',
        'sse-invalid-double-terminal',
      ]),
    )
  })

  it('executes every declared server fixture exactly once with an actual handler category', async () => {
    const { fixtures, traces } = await corpus()
    const executed = new Map<string, number>()
    for (const fixture of fixtures.filter((entry) => entry.consumers.includes('server'))) {
      const actual = executeFixture(fixture)
      executed.set(fixture.id, (executed.get(fixture.id) ?? 0) + 1)
      expect(actual.category).toBe(fixture.expectedCategory)
      expect(actual.accepted).toBe(fixture.expected === 'accept')
    }
    for (const trace of traces.filter((entry) => entry.consumers.includes('server'))) {
      const actual = validateSseTrace(trace.frames)
      executed.set(trace.id, (executed.get(trace.id) ?? 0) + 1)
      expect(trace.expectedCategory).toBe('trace')
      expect(actual.success).toBe(trace.expected === 'accept')
    }
    const declared = [...fixtures, ...traces].filter((entry) => entry.consumers.includes('server'))
    expect([...executed.entries()].filter(([, count]) => count !== 1)).toEqual([])
    expect(new Set(executed.keys())).toEqual(new Set(declared.map((entry) => entry.id)))
  })

  it('round-trips every HTTP success via the typed contract validation result', async () => {
    const { fixtures } = await corpus()
    for (const fixture of fixtures.filter(
      (entry) => entry.expected === 'accept' && entry.id.startsWith('http-'),
    )) {
      const result = validateContract(fixture.schemaId, fixture.value)
      expect(result.success).toBe(true)
      const typedValue = (result as { value: unknown }).value
      expect(canonicalJson(await reserializeHttpSuccess(typedValue))).toBe(
        canonicalJson(fixture.value),
      )
    }
  })
})
