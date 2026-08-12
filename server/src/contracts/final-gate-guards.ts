type Consumer = 'server' | 'android' | 'postgres' | 'room'

export interface FinalGateFixtureEntry {
  id: string
  operationId?: string
  toolName?: string
  schemaId?: string
  expected?: 'accept' | 'reject'
  consumers: readonly Consumer[]
  frames?: ReadonlyArray<{ event?: string }>
  value?: unknown
}

export interface FinalGateManifest {
  httpOperations: ReadonlyArray<{
    operationId: string
    responses: Readonly<Record<number, string | null>>
  }>
  functionTools: ReadonlyArray<{ name: string; inputSchemaId: string }>
  sseEvents: ReadonlyArray<{ event: string }>
}

const allowedConsumers = new Set<Consumer>(['server', 'android', 'postgres', 'room'])
const syntheticMarker = /(?:^|[^A-Za-z0-9])synthetic(?:$|[^A-Za-z0-9])/i

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function collectSensitiveValues(
  value: unknown,
  path = '$',
): Array<{ path: string; value: string }> {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectSensitiveValues(entry, `${path}[${index}]`))
  }
  if (value === null || typeof value !== 'object') return []

  const sensitive: Array<{ path: string; value: string }> = []
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`
    if (
      typeof entry === 'string' &&
      /(token|secret|password|familycode|apiKey|accessKey)$/i.test(key)
    ) {
      sensitive.push({ path: entryPath, value: entry })
    }
    sensitive.push(...collectSensitiveValues(entry, entryPath))
  }
  return sensitive
}

export function findNonSyntheticCredential(content: string): string | null {
  const normalizedContent = content.replaceAll('\\"', '"').replaceAll("\\'", "'")
  const keyedCredential =
    /["']?(apiKey|accessKey)["']?\s*[:=]\s*(?:["']([^"']+)["']|([A-Za-z0-9_./+=-]{8,}))/gi
  for (const match of normalizedContent.matchAll(keyedCredential)) {
    const value = match[2] ?? match[3]
    if (value && !syntheticMarker.test(value)) return `${match[1]}=${value}`
  }
  return null
}

function validateMetadata(entries: readonly FinalGateFixtureEntry[]): void {
  const ids = new Set<string>()
  for (const entry of entries) {
    invariant(typeof entry.id === 'string' && entry.id.length > 0, 'Every fixture must have an ID')
    invariant(!ids.has(entry.id), `Duplicate fixture ID: ${entry.id}`)
    ids.add(entry.id)
    invariant(
      entry.expected === 'accept' || entry.expected === 'reject',
      `${entry.id} has invalid expected result`,
    )
    invariant(entry.consumers.length > 0, `${entry.id} has no consumers`)
    for (const consumer of entry.consumers) {
      invariant(allowedConsumers.has(consumer), `${entry.id} has unknown consumer: ${consumer}`)
    }
    for (const sensitive of collectSensitiveValues(entry)) {
      invariant(
        syntheticMarker.test(sensitive.value),
        `${entry.id} contains a non-synthetic sensitive value at ${sensitive.path}`,
      )
    }
  }
}

function requireSharedConsumers(entry: FinalGateFixtureEntry): void {
  invariant(
    entry.consumers.includes('server') && entry.consumers.includes('android'),
    `${entry.id} must be shared by Server and Android`,
  )
}

function validateHttpCoverage(
  entries: readonly FinalGateFixtureEntry[],
  manifest: FinalGateManifest,
): void {
  const bindings = new Map(
    manifest.httpOperations.flatMap((operation) =>
      Object.entries(operation.responses)
        .filter(([status, schemaId]) => status.startsWith('2') && schemaId !== null)
        .map(([, schemaId]) => [operation.operationId, schemaId as string] as const),
    ),
  )
  const httpEntries = entries.filter((entry) => entry.operationId !== undefined)
  for (const entry of httpEntries) {
    invariant(
      bindings.has(entry.operationId as string),
      `${entry.id} references an unknown HTTP operation`,
    )
    invariant(
      entry.schemaId === bindings.get(entry.operationId as string),
      `${entry.id} does not match its HTTP operation schema`,
    )
    requireSharedConsumers(entry)
  }
  const accepted = httpEntries.filter((entry) => entry.expected === 'accept')
  invariant(
    accepted.length === bindings.size,
    'Fixture corpus must contain exactly one accepted fixture per concrete HTTP success operation',
  )
  invariant(
    new Set(accepted.map((entry) => entry.operationId)).size === bindings.size,
    'Fixture corpus does not cover every concrete HTTP success operation',
  )
}

function validateToolCoverage(
  entries: readonly FinalGateFixtureEntry[],
  manifest: FinalGateManifest,
): void {
  const bindings = new Map(manifest.functionTools.map((tool) => [tool.name, tool.inputSchemaId]))
  const toolEntries = entries.filter((entry) => entry.toolName !== undefined)
  for (const entry of toolEntries) {
    invariant(
      bindings.has(entry.toolName as string),
      `${entry.id} references an unknown function tool`,
    )
    invariant(
      entry.schemaId === bindings.get(entry.toolName as string),
      `${entry.id} does not match its function tool schema`,
    )
    requireSharedConsumers(entry)
  }
  const accepted = new Set(
    toolEntries.filter((entry) => entry.expected === 'accept').map((entry) => entry.toolName),
  )
  invariant(
    bindings.size === accepted.size && [...bindings.keys()].every((tool) => accepted.has(tool)),
    'Fixture corpus does not cover every function tool',
  )
}

function validateSseCoverage(
  entries: readonly FinalGateFixtureEntry[],
  manifest: FinalGateManifest,
): void {
  const traces = entries.filter((entry) => entry.frames !== undefined)
  for (const entry of traces) requireSharedConsumers(entry)
  const accepted = traces.filter((entry) => entry.expected === 'accept')
  const covered = new Set(
    accepted.flatMap((entry) => entry.frames?.map((frame) => frame.event) ?? []),
  )
  invariant(
    manifest.sseEvents.length === covered.size &&
      manifest.sseEvents.every((event) => covered.has(event.event)),
    'Fixture corpus does not cover every SSE event with accepted traces',
  )
}

export function validateFixtureCorpus(
  entries: readonly FinalGateFixtureEntry[],
  manifest: FinalGateManifest,
): void {
  validateMetadata(entries)
  validateHttpCoverage(entries, manifest)
  validateToolCoverage(entries, manifest)
  validateSseCoverage(entries, manifest)
}
