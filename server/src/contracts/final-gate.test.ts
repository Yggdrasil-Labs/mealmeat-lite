import { describe, expect, it } from 'vitest'
import {
  collectSensitiveValues,
  type FinalGateFixtureEntry,
  findNonSyntheticCredential,
  validateFixtureCorpus,
} from './final-gate-guards.js'

const manifest = {
  httpOperations: [{ operationId: 'getThing', responses: { 200: 'Thing' } }],
  functionTools: [{ name: 'get_thing', inputSchemaId: 'GetThingInput' }],
  sseEvents: [{ event: 'start' }, { event: 'done' }],
}

const entries: FinalGateFixtureEntry[] = [
  {
    id: 'http-thing',
    operationId: 'getThing',
    schemaId: 'Thing',
    expected: 'accept' as const,
    consumers: ['server', 'android'],
  },
  {
    id: 'tool-thing',
    toolName: 'get_thing',
    schemaId: 'GetThingInput',
    expected: 'accept' as const,
    consumers: ['server', 'android'],
  },
  {
    id: 'trace-thing',
    expected: 'accept' as const,
    consumers: ['server', 'android'],
    frames: [{ event: 'start' }, { event: 'done' }],
  },
]

describe('contract final gate guards', () => {
  it('requires exact authoritative bindings and accepted SSE coverage', () => {
    expect(() => validateFixtureCorpus(entries, manifest)).not.toThrow()
    expect(() =>
      validateFixtureCorpus(
        entries.map((entry) =>
          entry.id === 'http-thing' ? { ...entry, schemaId: 'WrongThing' } : entry,
        ),
        manifest,
      ),
    ).toThrow('does not match its HTTP operation schema')
    expect(() =>
      validateFixtureCorpus(
        entries.map((entry) =>
          entry.id === 'http-thing'
            ? { ...entry, operationId: 'spoofedOperation', schemaId: undefined }
            : entry,
        ),
        manifest,
      ),
    ).toThrow('unknown HTTP operation')
    expect(() =>
      validateFixtureCorpus(
        entries.concat({
          id: 'http-rejected-spoof',
          operationId: 'spoofedOperation',
          expected: 'reject',
          consumers: ['server', 'android'],
        }),
        manifest,
      ),
    ).toThrow('unknown HTTP operation')
    expect(() =>
      validateFixtureCorpus(
        entries.map((entry) =>
          entry.id === 'tool-thing'
            ? { ...entry, toolName: 'spoofed_tool', schemaId: undefined, expected: 'reject' }
            : entry,
        ),
        manifest,
      ),
    ).toThrow('unknown function tool')
    expect(() =>
      validateFixtureCorpus(
        entries.map((entry) =>
          entry.id === 'trace-thing' ? { ...entry, expected: 'reject' as const } : entry,
        ),
        manifest,
      ),
    ).toThrow('accepted traces')
    expect(() =>
      validateFixtureCorpus(
        entries.concat({
          id: 'trace-rejected-server-only',
          expected: 'reject',
          consumers: ['server'],
          frames: [{ event: 'start' }],
        }),
        manifest,
      ),
    ).toThrow('must be shared by Server and Android')
  })

  it('detects api-key-shaped sensitive fixture fields', () => {
    expect(collectSensitiveValues({ credentials: { apiKey: 'real-value' } })).toEqual([
      { path: '$.credentials.apiKey', value: 'real-value' },
    ])
    expect(() =>
      validateFixtureCorpus(
        entries.map((entry) =>
          entry.id === 'http-thing' ? { ...entry, value: { apiKey: 'real-value' } } : entry,
        ),
        manifest,
      ),
    ).toThrow('non-synthetic sensitive value')
    expect(() =>
      validateFixtureCorpus(
        entries.map((entry) =>
          entry.id === 'http-thing' ? { ...entry, value: { apiKey: 'nonsynthetic-key' } } : entry,
        ),
        manifest,
      ),
    ).toThrow('non-synthetic sensitive value')
    expect(findNonSyntheticCredential('val apiKey = "real-model-credential"')).toBe(
      'apiKey=real-model-credential',
    )
    expect(findNonSyntheticCredential('accessKey: real-model-credential')).toBe(
      'accessKey=real-model-credential',
    )
    expect(findNonSyntheticCredential('apiKey: nonsynthetic-real-value')).toBe(
      'apiKey=nonsynthetic-real-value',
    )
    expect(
      findNonSyntheticCredential('val vector = "{\\"apiKey\\":\\"real-model-credential\\"}"'),
    ).toBe('apiKey=real-model-credential')
    expect(findNonSyntheticCredential('{"accessKey":"synthetic-access-key"}')).toBeNull()
    expect(findNonSyntheticCredential('{"confirmationToken":"token-1"}')).toBeNull()
  })

  it('rejects undeclared expected results and missing shared consumers', () => {
    expect(() =>
      validateFixtureCorpus(
        entries.map((entry) =>
          entry.id === 'tool-thing'
            ? { ...entry, expected: 'maybe' as never, consumers: ['server'] }
            : entry,
        ),
        manifest,
      ),
    ).toThrow('invalid expected result')
  })
})
