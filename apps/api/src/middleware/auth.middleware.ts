import type { Context, Next } from 'hono'
import { authService } from '../services/auth.service.js'
import type { User } from '@codecomply/db'

// Extend the context to include our custom properties
declare module 'hono' {
  interface ContextVariableMap {
    user: User
    userId: string
  }
}

/**
 * Verify JWT and attach user to context
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.substring(7)
  const user = await authService.validateToken(token)

  if (!user) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  // Attach user to context
  c.set('user', user)
  c.set('userId', user.id)

  await next()
}

export { roleMiddleware, requirePermission } from './role.js'
export type { AppRole, RolePermission } from './role.js'
