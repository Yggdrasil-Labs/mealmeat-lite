import { describe, expect, it, vi } from 'vitest'
import { createOpenAICompatibleProbe, runModelVerify } from './cli.js'
import { ModelCatalog } from './services/models/model-catalog.js'

function makeCatalog(ids: readonly string[] = ['default']) {
  return ModelCatalog.load({
    readFile: () =>
      JSON.stringify({
        models: ids.map((id, index) => ({
          id,
          displayName: id,
          baseURL: 'https://provider.example/v1',
          model: `${id}-1`,
          apiKeyEnv: `${id.toUpperCase()}_KEY`,
          enabled: true,
          isDefault: index === 0,
          capabilities: { streaming: true, tools: true },
        })),
      }),
    env: Object.fromEntries(ids.map((id) => [`${id.toUpperCase()}_KEY`, 'secret-value'])),
  })
}

function makeCatalogWithMissingKey() {
  return ModelCatalog.load({
    readFile: () =>
      JSON.stringify({
        models: [
          {
            id: 'available',
            displayName: 'Available',
            baseURL: 'https://provider.example/v1',
            model: 'available-1',
            apiKeyEnv: 'AVAILABLE_KEY',
            enabled: true,
            isDefault: true,
            capabilities: { streaming: true, tools: true },
          },
          {
            id: 'missing-key',
            displayName: 'Missing key',
            baseURL: 'https://provider.example/v1',
            model: 'missing-1',
            apiKeyEnv: 'MISSING_KEY',
            enabled: true,
            isDefault: false,
            capabilities: { streaming: true, tools: true },
          },
        ],
      }),
    env: { AVAILABLE_KEY: 'secret-value' },
  })
}

function sseResponse(argumentsText: string) {
  const payload = JSON.stringify({
    choices: [
      {
        delta: {
          content: 'ok',
          tool_calls: [{ function: { name: 'no_op', arguments: argumentsText } }],
        },
      },
    ],
  })
  return new Response(`data: ${payload}\n\ndata: [DONE]\n\n`, { status: 200 })
}

describe('models verify', () => {
  it('uses the injected no-op probe and emits only the model id and pass result', async () => {
    const output = vi.fn()

    await runModelVerify({
      catalog: makeCatalog(),
      probe: async () => ({ delta: 'ok', toolCall: { name: 'no_op', input: {} } }),
      output,
    })

    expect(output).toHaveBeenCalledWith('[models] default pass')
    expect(output.mock.calls.flat()).not.toContain('secret-value')
  })

  it('rejects probe failures with a redacted category', async () => {
    const output = vi.fn()

    await expect(
      runModelVerify({
        catalog: makeCatalog(),
        probe: async () => ({ delta: '', toolCall: { name: 'other', input: {} } }),
        output,
      }),
    ).rejects.toThrow('MODEL_VERIFY_FAILED')
    expect(output).toHaveBeenCalledWith('[models] default fail INVALID_PROBE')
  })

  it.each([
    { name: 'array input', input: [] },
    { name: 'extra tool argument', input: { unexpected: true } },
  ])('rejects a $name as an invalid no-op tool call', async ({ input }) => {
    const output = vi.fn()

    await expect(
      runModelVerify({
        catalog: makeCatalog(),
        probe: async () => ({ delta: 'ok', toolCall: { name: 'no_op', input } }),
        output,
      }),
    ).rejects.toThrow('MODEL_VERIFY_FAILED')
    expect(output).toHaveBeenCalledWith('[models] default fail INVALID_PROBE')
  })

  it('probes each enabled model and continues after an earlier failure without leaking it', async () => {
    const output = vi.fn()
    const probe = vi.fn(async (model: { id: string }) => {
      if (model.id === 'first') throw new Error('https://provider.example secret-value raw-body')
      return { delta: 'ok', toolCall: { name: 'no_op', input: {} } }
    })

    await expect(
      runModelVerify({ catalog: makeCatalog(['first', 'second']), probe, output }),
    ).rejects.toThrow('MODEL_VERIFY_FAILED')

    expect(probe).toHaveBeenCalledTimes(2)
    expect(output).toHaveBeenCalledWith('[models] first fail PROVIDER_ERROR')
    expect(output).toHaveBeenCalledWith('[models] second pass')
    expect(output.mock.calls.flat().join(' ')).not.toMatch(
      /provider\.example|secret-value|raw-body/,
    )
  })

  it('reports a timeout category without exposing probe details', async () => {
    const output = vi.fn()

    await expect(
      runModelVerify({
        catalog: makeCatalog(),
        probe: async () => await new Promise(() => undefined),
        output,
        timeoutMs: 1,
      }),
    ).rejects.toThrow('MODEL_VERIFY_FAILED')

    expect(output).toHaveBeenCalledWith('[models] default fail TIMEOUT')
  })

  it('reports a missing key without probing that model or exposing its key name', async () => {
    const output = vi.fn()
    const probe = vi.fn(async () => ({ delta: 'ok', toolCall: { name: 'no_op', input: {} } }))

    await expect(
      runModelVerify({ catalog: makeCatalogWithMissingKey(), probe, output }),
    ).rejects.toThrow('MODEL_VERIFY_FAILED')

    expect(probe).toHaveBeenCalledTimes(1)
    expect(output).toHaveBeenCalledWith('[models] available pass')
    expect(output).toHaveBeenCalledWith('[models] missing-key fail MISSING_API_KEY')
    expect(output.mock.calls.flat().join(' ')).not.toContain('MISSING_KEY')
  })

  it.each(['', '{'])(
    'rejects %j provider tool arguments as an invalid probe',
    async (argumentsText) => {
      const probe = createOpenAICompatibleProbe(async () => sseResponse(argumentsText))

      await expect(probe(makeCatalog().resolveRequested('default'))).rejects.toThrow(
        'INVALID_PROBE',
      )
    },
  )
})
