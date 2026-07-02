import { Before, Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { Hono } from 'hono'
import {
  MemoryRateLimitStore,
  loginRateLimitMiddleware,
  rateLimitMiddleware,
} from '../../../../apps/api/src/middleware/rate-limit.js'

let store: MemoryRateLimitStore
let loginLimit = 5
let apiLimit = 100
let windowMs = 60_000
let loginResponses: Response[] = []
let lastApiResponse: Response
let blockedResponse: Response

function loginApp() {
  const app = new Hono()
  app.use(
    '*',
    loginRateLimitMiddleware({
      store,
      config: { limit: loginLimit, windowMs },
    }),
  )
  app.post('/auth/login', (c) => c.json({ ok: true }, 401))
  return app
}

function apiApp() {
  const app = new Hono<{ Variables: { userId: string } }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'e2e-user')
    await next()
  })
  app.use(
    '*',
    rateLimitMiddleware('api', {
      store,
      config: { limit: apiLimit, windowMs },
    }),
  )
  app.get('/api/permits', (c) => c.json([]))
  return app
}

Before({ tags: '@M11-S6' }, function () {
  store = new MemoryRateLimitStore()
  loginLimit = 5
  apiLimit = 100
  windowMs = 60_000
  loginResponses = []
})

Given('a login rate limit of {int} attempts per minute', function (limit: number) {
  loginLimit = limit
  windowMs = 60_000
})

Given('an API rate limit of {int} requests per minute', function (limit: number) {
  apiLimit = limit
  windowMs = 60_000
})

Given(
  'a login rate limit of {int} attempt per {int} milliseconds',
  function (limit: number, ms: number) {
    loginLimit = limit
    windowMs = ms
  },
)

When('I send {int} login requests from the same IP', async function (count: number) {
  const headers = { 'X-Forwarded-For': '198.51.100.10' }
  loginResponses = []
  for (let i = 0; i < count; i++) {
    loginResponses.push(
      await loginApp().request('/auth/login', { method: 'POST', headers, body: '{}' }),
    )
  }
})

When('I send an API request from a fresh IP', async function () {
  lastApiResponse = await apiApp().request('/api/permits', {
    headers: { 'X-Forwarded-For': '198.51.100.20' },
  })
})

When('I exceed the login rate limit from the same IP', async function () {
  const headers = { 'X-Forwarded-For': '198.51.100.30' }
  await loginApp().request('/auth/login', { method: 'POST', headers, body: '{}' })
  blockedResponse = await loginApp().request('/auth/login', { method: 'POST', headers, body: '{}' })
})

When('I wait for the rate limit window to expire', async function () {
  await new Promise((resolve) => setTimeout(resolve, windowMs + 50))
})

Then('the third login response status should be {int}', function (status: number) {
  expect(loginResponses[2]?.status).toBe(status)
})

Then('the rate limit response should indicate too many requests', async function () {
  const body = (await loginResponses[2]?.json()) as { code: string; error: string }
  expect(body.code).toBe('RATE_LIMIT_EXCEEDED')
  expect(body.error).toBe('Too Many Requests')
})

Then('the response should include rate limit headers', function () {
  expect(lastApiResponse.headers.get('X-RateLimit-Limit')).toBe(String(apiLimit))
  expect(lastApiResponse.headers.get('X-RateLimit-Remaining')).toBeTruthy()
  expect(lastApiResponse.headers.get('X-RateLimit-Reset')).toBeTruthy()
})

Then('the remaining allowance should be less than the limit', function () {
  const remaining = Number(lastApiResponse.headers.get('X-RateLimit-Remaining'))
  expect(remaining).toBeLessThan(apiLimit)
})

Then('the next login request should be allowed', async function () {
  const res = await loginApp().request('/auth/login', {
    method: 'POST',
    headers: { 'X-Forwarded-For': '198.51.100.30' },
    body: '{}',
  })
  expect(res.status).not.toBe(429)
  expect(blockedResponse.status).toBe(429)
})
