import { Before, Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { Hono } from 'hono'
import type { User } from '@codecomply/db'
import { roleMiddleware, requirePermission } from '../../../../apps/api/src/middleware/role.js'
import { remoteWipePendingMiddleware } from '../../../../apps/api/src/middleware/remote-wipe-pending.js'
import type { UserWithRemoteWipe } from '../../../../apps/api/src/services/remote-wipe.service.js'

let lastResponse: Response
let currentUser: UserWithRemoteWipe | null = null

function remoteWipeTestApp() {
  const app = new Hono<{ Variables: { user: User; userId: string } }>()
  app.use('*', async (c, next) => {
    if (!currentUser) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    c.set('user', currentUser)
    c.set('userId', currentUser.id)
    await next()
  })
  app.use('/api/*', remoteWipePendingMiddleware)

  const admin = new Hono()
  admin.use('*', roleMiddleware(['ADMIN']))
  admin.use('/users/*', requirePermission('manage_users'))
  admin.post('/users/:id/remote-wipe', (c) => {
    const id = c.req.param('id')
    return c.json({
      message: 'Remote wipe requested',
      requestedAt: new Date().toISOString(),
      userId: id,
    })
  })
  app.route('/api/admin', admin)

  const device = new Hono()
  device.use('*', roleMiddleware(['SCO']))
  device.get('/remote-wipe/status', (c) => {
    const user = c.get('user') as UserWithRemoteWipe
    const pending = Boolean(user.remoteWipeRequestedAt)
    return c.json({
      pending,
      message: pending ? 'Device wiped by administrator' : undefined,
    })
  })
  device.post('/remote-wipe/confirm', () =>
    Response.json({
      message: 'Remote wipe confirmed',
      confirmedAt: new Date().toISOString(),
    }),
  )
  app.route('/api/device', device)

  const sync = new Hono()
  sync.get('/pull', (c) => c.json({ changes: [], hasMore: false }))
  app.route('/api/sync', sync)

  return app
}

Before({ tags: '@M11-S4' }, () => {
  currentUser = null
  lastResponse = new Response(null, { status: 204 })
})

Given('an authenticated admin user for remote wipe tests', () => {
  currentUser = {
    id: 'admin-wipe-e2e',
    role: 'ADMIN',
  } as UserWithRemoteWipe
})

Given('an authenticated SCO user with pending remote wipe', () => {
  currentUser = {
    id: 'sco-wipe-e2e',
    role: 'SCO',
    remoteWipeRequestedAt: new Date('2026-05-19T10:00:00Z'),
  } as UserWithRemoteWipe
})

When('the admin triggers remote wipe for inspector {string}', async (targetId: string) => {
  lastResponse = await remoteWipeTestApp().request(
    `/api/admin/users/${encodeURIComponent(targetId)}/remote-wipe`,
    { method: 'POST' },
  )
})

When('the SCO requests the sync status API for remote wipe tests', async () => {
  lastResponse = await remoteWipeTestApp().request('/api/sync/pull')
})

When('the SCO confirms remote wipe on the device API', async () => {
  lastResponse = await remoteWipeTestApp().request('/api/device/remote-wipe/confirm', {
    method: 'POST',
  })
})

Then('the remote wipe API response status should be {int}', (status: number) => {
  expect(lastResponse.status).toBe(status)
})

Then('the remote wipe API response should indicate wipe requested', async () => {
  const body = (await lastResponse.json()) as { message: string; userId: string }
  expect(body.message).toContain('Remote wipe requested')
  expect(body.userId).toBeTruthy()
})
