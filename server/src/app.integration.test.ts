import { describe, expect, it } from 'vitest'
import { app } from './app.js'

describe('server application', () => {
  it('serves the bootstrap metadata endpoint', async () => {
    const response = await app.request('/')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      name: 'mealmate-lite',
      version: '0.1.0',
    })
  })
})
