import { describe, it, expect, beforeEach, vi } from 'vitest'
import { testClient } from 'hono/testing'
import app from './permits'
import { permitService } from '../services/permit.service'
import { permitTriageService } from '../services/permit-triage.service'
import { PermitMapper } from '../mappers/permit.mapper'

// Mock service and mapper
vi.mock('../services/permit.service')
vi.mock('../services/permit-triage.service')
vi.mock('../mappers/permit.mapper')

describe('Permits Routes', () => {
  // testClient() returns unknown when app is mocked; assert for route access
  const client = testClient(app) as {
    index: { $get: (opts: { query?: Record<string, unknown> }) => Promise<Response> }
    nearby: { $get: (opts: { query?: Record<string, unknown> }) => Promise<Response> }
    ':id': { $get: (opts: { param: { id: string } }) => Promise<Response> }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(permitTriageService.buildTriageSummariesForPermits).mockResolvedValue(new Map())
  })

  describe('GET /', () => {
    it('should return list of permits', async () => {
      const mockPermits = [
        {
          id: 'permit-1',
          permitNumber: 'P-2024-001',
          address: '123 Main St',
          status: 'ACTIVE',
        },
        {
          id: 'permit-2',
          permitNumber: 'P-2024-002',
          address: '456 Oak Ave',
          status: 'ACTIVE',
        },
      ]

      const mockDTOs = [
        {
          id: 'permit-1',
          permitNumber: 'P-2024-001',
          address: '123 Main St',
          status: 'ACTIVE',
        },
        {
          id: 'permit-2',
          permitNumber: 'P-2024-002',
          address: '456 Oak Ave',
          status: 'ACTIVE',
        },
      ]

      vi.mocked(permitService.search).mockResolvedValue(mockPermits as any)
      vi.mocked(PermitMapper.toListDTOs).mockReturnValue(mockDTOs as any)

      const res = await client.index.$get({
        query: {},
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(mockDTOs)
      expect(permitService.search).toHaveBeenCalledWith({
        permitNumber: undefined,
        address: undefined,
        status: undefined,
        limit: 20,
        offset: 0,
      })
    })

    it('should filter by permit number', async () => {
      vi.mocked(permitService.search).mockResolvedValue([])
      vi.mocked(PermitMapper.toListDTOs).mockReturnValue([])

      await client.index.$get({
        query: { permitNumber: 'P-2024-001' },
      })

      expect(permitService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          permitNumber: 'P-2024-001',
        }),
      )
    })

    it('should filter by address', async () => {
      vi.mocked(permitService.search).mockResolvedValue([])
      vi.mocked(PermitMapper.toListDTOs).mockReturnValue([])

      await client.index.$get({
        query: { address: 'Main Street' },
      })

      expect(permitService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          address: 'Main Street',
        }),
      )
    })

    it('should filter by status', async () => {
      vi.mocked(permitService.search).mockResolvedValue([])
      vi.mocked(PermitMapper.toListDTOs).mockReturnValue([])

      await client.index.$get({
        query: { status: 'ACTIVE' },
      })

      expect(permitService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ACTIVE',
        }),
      )
    })

    it('should apply pagination', async () => {
      vi.mocked(permitService.search).mockResolvedValue([])
      vi.mocked(PermitMapper.toListDTOs).mockReturnValue([])

      await client.index.$get({
        query: { limit: 10, offset: 20 },
      })

      expect(permitService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 20,
        }),
      )
    })

    it('should return 500 on service error', async () => {
      vi.mocked(permitService.search).mockRejectedValue(new Error('Database error'))

      const res = await client.index.$get({
        query: {},
      })

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })
  })

  describe('GET /:id', () => {
    it('should return permit details', async () => {
      const mockPermit = {
        id: 'permit-123',
        permitNumber: 'P-2024-001',
        address: '123 Main St',
        status: 'ACTIVE',
      }

      const mockDTO = {
        id: 'permit-123',
        permitNumber: 'P-2024-001',
        address: '123 Main St',
        status: 'ACTIVE',
      }

      vi.mocked(permitService.getById).mockResolvedValue(mockPermit as any)
      vi.mocked(PermitMapper.toDTO).mockReturnValue(mockDTO as any)

      const res = await client[':id'].$get({
        param: { id: 'permit-123' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(mockDTO)
      expect(permitService.getById).toHaveBeenCalledWith('permit-123')
    })

    it('should return 404 if permit not found', async () => {
      vi.mocked(permitService.getById).mockResolvedValue(null)

      const res = await client[':id'].$get({
        param: { id: 'non-existent' },
      })

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Permit not found')
    })

    it('should return 500 on service error', async () => {
      vi.mocked(permitService.getById).mockRejectedValue(new Error('Database error'))

      const res = await client[':id'].$get({
        param: { id: 'permit-123' },
      })

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })
  })

  describe('GET /nearby', () => {
    it('should return nearby permits', async () => {
      const mockPermits = [
        {
          id: 'permit-1',
          permitNumber: 'P-2024-001',
          address: '123 Main St',
          status: 'ACTIVE',
          distance: 100,
        },
        {
          id: 'permit-2',
          permitNumber: 'P-2024-002',
          address: '456 Oak Ave',
          status: 'ACTIVE',
          distance: 250,
        },
      ]

      const mockDTOs = [
        {
          id: 'permit-1',
          permitNumber: 'P-2024-001',
          address: '123 Main St',
          status: 'ACTIVE',
          distance: 100,
        },
        {
          id: 'permit-2',
          permitNumber: 'P-2024-002',
          address: '456 Oak Ave',
          status: 'ACTIVE',
          distance: 250,
        },
      ]

      vi.mocked(permitService.findNearby).mockResolvedValue({
        permits: mockPermits as any,
        totalWithCoordinates: mockPermits.length,
      })
      vi.mocked(PermitMapper.toListDTOs).mockReturnValue(mockDTOs as any)

      const res = await client.nearby.$get({
        query: {
          latitude: 51.0447,
          longitude: -114.0719,
        },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(mockDTOs)
      expect(permitService.findNearby).toHaveBeenCalledWith(
        51.0447,
        -114.0719,
        5000, // Default radius
        undefined,
        20, // Default limit
      )
    })

    it('should use custom radius', async () => {
      vi.mocked(permitService.findNearby).mockResolvedValue({
        permits: [],
        totalWithCoordinates: 0,
      })
      vi.mocked(PermitMapper.toListDTOs).mockReturnValue([])

      await client.nearby.$get({
        query: {
          latitude: 51.0447,
          longitude: -114.0719,
          radius: 1000,
        },
      })

      expect(permitService.findNearby).toHaveBeenCalledWith(51.0447, -114.0719, 1000, undefined, 20)
    })

    it('should filter by status', async () => {
      vi.mocked(permitService.findNearby).mockResolvedValue({
        permits: [],
        totalWithCoordinates: 0,
      })
      vi.mocked(PermitMapper.toListDTOs).mockReturnValue([])

      await client.nearby.$get({
        query: {
          latitude: 51.0447,
          longitude: -114.0719,
          status: 'ACTIVE',
        },
      })

      expect(permitService.findNearby).toHaveBeenCalledWith(51.0447, -114.0719, 5000, 'ACTIVE', 20)
    })

    it('should apply limit', async () => {
      vi.mocked(permitService.findNearby).mockResolvedValue({
        permits: [],
        totalWithCoordinates: 0,
      })
      vi.mocked(PermitMapper.toListDTOs).mockReturnValue([])

      await client.nearby.$get({
        query: {
          latitude: 51.0447,
          longitude: -114.0719,
          limit: 10,
        },
      })

      expect(permitService.findNearby).toHaveBeenCalledWith(51.0447, -114.0719, 5000, undefined, 10)
    })

    it('should return 500 on service error', async () => {
      vi.mocked(permitService.findNearby).mockRejectedValue(new Error('Database error'))

      const res = await client.nearby.$get({
        query: {
          latitude: 51.0447,
          longitude: -114.0719,
        },
      })

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })

    it('should coerce string query parameters to numbers', async () => {
      vi.mocked(permitService.findNearby).mockResolvedValue({
        permits: [],
        totalWithCoordinates: 0,
      })
      vi.mocked(PermitMapper.toListDTOs).mockReturnValue([])

      // Simulate query params as strings (as they come from URLSearchParams)
      const res = await client.nearby.$get({
        query: {
          latitude: '51.0447' as any,
          longitude: '-114.0719' as any,
          radius: '10000' as any,
          limit: '15' as any,
        },
      })

      expect(res.status).toBe(200)
      expect(permitService.findNearby).toHaveBeenCalledWith(
        51.0447,
        -114.0719,
        10000,
        undefined,
        15,
      )
    })
  })
})
