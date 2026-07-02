/**
 * M11-S20 — performance monitoring: expose response time and log slow requests.
 */
import type { MiddlewareHandler } from 'hono'

/** Alert when response time exceeds 500ms (M11-S20) */
export const REQUEST_TIMING_SLOW_MS = 500

export const requestTimingMiddleware: MiddlewareHandler = async (c, next) => {
  const start = performance.now()
  await next()
  const durationMs = Math.round(performance.now() - start)
  c.header('X-Response-Time', `${durationMs}ms`)

  if (durationMs > REQUEST_TIMING_SLOW_MS) {
    console.warn(
      `[performance monitoring] ${c.req.method} ${c.req.path} ${durationMs}ms (threshold ${REQUEST_TIMING_SLOW_MS}ms)`,
    )
  }
}
