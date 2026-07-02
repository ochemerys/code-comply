import type { Context, Next } from 'hono'
import { isRemoteWipePending, type UserWithRemoteWipe } from '../services/remote-wipe.service.js'

const ALLOWED_PREFIXES = ['/api/device/remote-wipe']

/**
 * Blocks API access for inspectors with a pending remote wipe (except wipe status/confirm).
 */
export async function remoteWipePendingMiddleware(c: Context, next: Next) {
  const user = c.get('user') as UserWithRemoteWipe | undefined
  if (!user || user.role !== 'SCO') {
    await next()
    return
  }

  const path = c.req.path
  if (ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    await next()
    return
  }

  if (isRemoteWipePending(user)) {
    return c.json(
      {
        error: 'RemoteWipePending',
        message: 'Device wipe required. Open the app to complete remote wipe.',
      },
      403,
    )
  }

  await next()
}
