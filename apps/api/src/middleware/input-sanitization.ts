import type { MiddlewareHandler } from 'hono'
import { sanitizeDeep } from '../lib/sanitization.js'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH'])

type JsonRequest = {
  text: () => Promise<string>
  json: <T>() => Promise<T>
}

/**
 * Global input sanitization middleware (M11-S5).
 * Sanitizes JSON request bodies before route validation and handlers run.
 */
export function inputSanitizationMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    if (MUTATING_METHODS.has(c.req.method)) {
      const contentType = c.req.header('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const req = c.req as JsonRequest
        const readText = req.text.bind(c.req)
        let sanitizedText: string | undefined

        req.text = async () => {
          if (sanitizedText !== undefined) {
            return sanitizedText
          }
          const text = await readText()
          if (text.length === 0) {
            sanitizedText = text
            return text
          }
          try {
            const parsed = JSON.parse(text) as unknown
            sanitizedText = JSON.stringify(sanitizeDeep(parsed))
          } catch {
            sanitizedText = text
          }
          return sanitizedText
        }

        req.json = async <T>() => {
          const text = await req.text()
          if (text.length === 0) {
            return {} as T
          }
          return JSON.parse(text) as T
        }
      }
    }

    await next()
  }
}
