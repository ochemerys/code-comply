import { describe, it, expect } from 'vitest'
import { QueryClient } from '@tanstack/vue-query'
import {
  ADMIN_QUERY_MAX_RETRIES,
  ADMIN_QUERY_STALE_TIME_MS,
  createAdminQueryClient,
  shouldRetryAdminQuery,
} from './query-client'
import { SessionExpiredRedirectError } from '@/utils/admin-api-fetch'

describe('createAdminQueryClient', () => {
  it('returns a QueryClient with shared admin defaults', () => {
    const client = createAdminQueryClient()
    expect(client).toBeInstanceOf(QueryClient)

    const queries = client.getDefaultOptions().queries
    expect(queries?.staleTime).toBe(ADMIN_QUERY_STALE_TIME_MS)
    expect(queries?.retry).toBe(shouldRetryAdminQuery)
    expect(queries?.refetchOnWindowFocus).toBe(false)

    expect(client.getDefaultOptions().mutations?.retry).toBe(false)
  })
})

describe('shouldRetryAdminQuery', () => {
  it('never retries when the session has expired (401 → redirect)', () => {
    expect(shouldRetryAdminQuery(0, new SessionExpiredRedirectError())).toBe(false)
  })

  it('retries transient errors up to the max retry count', () => {
    const error = new Error('network blip')
    expect(shouldRetryAdminQuery(0, error)).toBe(true)
    expect(shouldRetryAdminQuery(ADMIN_QUERY_MAX_RETRIES, error)).toBe(false)
    expect(shouldRetryAdminQuery(ADMIN_QUERY_MAX_RETRIES + 1, error)).toBe(false)
  })
})
