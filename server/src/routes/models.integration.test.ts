import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { ModelCatalog } from '../services/models/model-catalog.js'
import { createModelsRoutes } from './models.js'

function makeCatalog() {
  return ModelCatalog.load({
    readFile: () =>
      JSON.stringify({
        models: [
          {
            id: 'default',
            displayName: 'Default',
            baseURL: 'https://provider.example/v1',
            model: 'default-1',
            apiKeyEnv: 'MODEL_API_KEY',
            enabled: true,
            isDefault: true,
            capabilities: { streaming: true, tools: true },
          },
        ],
      }),
    env: { MODEL_API_KEY: 'secret-value' },
  })
}

describe('GET /api/v1/models', () => {
  it('returns the frozen public DTO and never provider configuration', async () => {
    const app = new Hono()
    app.route('/api/v1', createModelsRoutes({ getModelCatalog: makeCatalog }))

    const response = await app.request('/api/v1/models')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      items: [{ id: 'default', displayName: 'Default', isDefault: true }],
    })
  })
})
