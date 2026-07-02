import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import healthRoutes from './routes/health.js'
import authRoutes from './routes/auth.js'

// Create OpenAPI-enabled app
const app = new OpenAPIHono()

// Global middleware
app.use(logger())
app.use(prettyJSON())
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5175',
      'http://localhost:5174',
      process.env.INSPECTOR_URL || '',
      process.env.ADMIN_URL || '',
    ].filter(Boolean),
    credentials: true,
  }),
)

// OpenAPI documentation
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'CodeComply Connect API',
    description:
      'API for managing safety codes inspections, deficiencies, and compliance documentation',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'Health check endpoints',
    },
    {
      name: 'Authentication',
      description: 'User authentication and authorization',
    },
  ],
})

// Swagger UI
app.get('/swagger', swaggerUI({ url: '/openapi.json' }))

// Routes
app.route('/health', healthRoutes)
app.route('/auth', authRoutes)

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

export { app }
