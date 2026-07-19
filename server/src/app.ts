import { Hono } from 'hono'
import { healthRoutes } from './routes/health'

export const app = new Hono()

// Health check routes (public, no auth)
app.route('/health', healthRoutes)

// API v1 routes placeholder
app.get('/', (c) => c.json({ name: 'mealmate-lite', version: '0.1.0' }))
