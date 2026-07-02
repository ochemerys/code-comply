import { serve } from '@hono/node-server'
import { logCorsConfiguration } from './lib/cors-config.js'
import { initSentry } from './lib/sentry.js'
import { app } from './app.js'

initSentry()
logCorsConfiguration()

const port = parseInt(process.env.PORT || '4000')
const host = process.env.HOST || '0.0.0.0'

// eslint-disable-next-line no-console
console.log(`🔥 Hono API server starting on http://${host}:${port}`)
// eslint-disable-next-line no-console
console.log(`   Production: Render automatic TLS (TLS 1.2+) terminates HTTPS at the edge — M11-S2`)
// eslint-disable-next-line no-console
console.log(`📚 Swagger UI available at http://localhost:${port}/swagger`)
// eslint-disable-next-line no-console
console.log(`📄 OpenAPI spec available at http://localhost:${port}/openapi.json`)

serve({
  fetch: app.fetch,
  port,
  hostname: host,
})

export type { AppType } from './client-app-type.js'
