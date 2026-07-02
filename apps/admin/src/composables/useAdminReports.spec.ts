import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { UserDTO } from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import {
  fetchAdminInspections,
  fetchInspectionReports,
  fetchReportDownloadUrl,
  postGenerateReport,
  reportTypeLabel,
} from './useAdminReports'

const iso = () => new Date().toISOString()

const adminUser = (): UserDTO => ({
  id: 'admin',
  email: 'admin@test.com',
  name: 'Admin',
  role: 'ADMIN',
  disciplines: [],
  certifications: [],
  createdAt: iso(),
  updatedAt: iso(),
})

describe('useAdminReports fetch helpers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.setUser(adminUser())
    auth.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })
    vi.restoreAllMocks()
  })

  it('reportTypeLabel maps API types to story labels', () => {
    expect(reportTypeLabel('INSPECTION')).toBe('Inspection Report')
    expect(reportTypeLabel('NO_ENTRY')).toBe('No Entry Letter')
  })

  it('fetchAdminInspections calls list endpoint with status filter', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await fetchAdminInspections({ status: 'IN_PROGRESS', limit: 100 })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/inspections\?.*status=IN_PROGRESS/),
      expect.any(Object),
    )
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(firstCall[1].headers).toBeInstanceOf(Headers)
    expect((firstCall[1].headers as Headers).get('Authorization')).toBe('Bearer tok')

    vi.unstubAllGlobals()
  })

  it('postGenerateReport posts generate payload', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 'r1',
            inspectionId: 'insp-1',
            type: 'INSPECTION',
            filename: 'inspection-report.pdf',
            storageKey: 'k',
            hash: 'h',
            generatedAt: iso(),
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await postGenerateReport({ inspectionId: 'insp-1', type: 'INSPECTION' })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/reports/generate'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ inspectionId: 'insp-1', type: 'INSPECTION' }),
      }),
    )

    vi.unstubAllGlobals()
  })

  it('fetchInspectionReports loads history for inspection', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await fetchInspectionReports('insp-1')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/inspections/insp-1/reports'),
      expect.any(Object),
    )

    vi.unstubAllGlobals()
  })

  it('fetchReportDownloadUrl returns signed url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ url: 'https://cdn.example/r.pdf', expiresIn: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )

    const result = await fetchReportDownloadUrl('r1')
    expect(result.url).toContain('https://cdn.example')

    vi.unstubAllGlobals()
  })
})
