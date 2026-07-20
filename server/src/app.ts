import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { onError } from './middleware/on-error.js'
import { onNotFound } from './middleware/on-not-found.js'
import { healthRoutes } from './routes/health.js'

// 构建时 tsc 输出到 dist/，package.json 在上一级目录
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as {
  version: string
}

export const app = new Hono()

// Health check routes (public, no auth)
app.route('/health', healthRoutes)

// API v1 routes placeholder
app.get('/', (c) => c.json({ name: 'mealmate-lite', version: pkg.version }))

// Global error handlers — must be registered after all routes
app.onError(onError)
app.notFound(onNotFound)
