import { Before, Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { Hono } from 'hono'
import type { User } from '@codecomply/db'
import {
  roleMiddleware,
  requirePermission,
  RBAC_FORBIDDEN_CODE,
} from '../../../../apps/api/src/middleware/role.js'

let lastResponse: Response
let currentUser: User | null = null

function rbacTestApp() {
  const app = new Hono<{ Variables: { user: User; userId: string } }>()
  app.use('*', async (c, next) => {
    if (!currentUser) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    c.set('user', currentUser)
    c.set('userId', currentUser.id)
    await next()
  })

  const admin = new Hono()
  admin.use('*', roleMiddleware(['ADMIN']))
  admin.use('/users/*', requirePermission('manage_users'))
  admin.get('/users', (c) => c.json({ users: [] }))
  app.route('/api/admin', admin)

  const voc = new Hono()
  voc.use('*', requirePermission('review_voc'))
  voc.get('/pending', (c) => c.json([]))
  app.route('/api/voc', voc)

  return app
}

Before({ tags: '@M11-S3' }, function () {
  currentUser = null
})

Given('an authenticated SCO user for RBAC tests', function () {
  currentUser = {
    id: 'sco-e2e',
    role: 'SCO',
  } as User
})

Given('an authenticated admin user for RBAC tests', function () {
  currentUser = {
    id: 'admin-e2e',
    role: 'ADMIN',
  } as User
})

When('the SCO requests the admin users API', async function () {
  lastResponse = await rbacTestApp().request('/api/admin/users')
})

When('the admin requests the admin users API', async function () {
  lastResponse = await rbacTestApp().request('/api/admin/users')
})

When('the SCO requests the VoC pending queue API', async function () {
  lastResponse = await rbacTestApp().request('/api/voc/pending')
})

Then('the RBAC API response status should be {int}', function (status: number) {
  expect(lastResponse.status).toBe(status)
})

Then('the RBAC API response should indicate forbidden', async function () {
  const body = (await lastResponse.json()) as { code: string }
  expect(body.code).toBe(RBAC_FORBIDDEN_CODE)
})
