import { describe, it, expect, beforeEach, vi } from 'vitest'
import { testClient } from 'hono/testing'
import { Hono } from 'hono'
import app from './inspections'
import { inspectionService } from '../services/inspection.service'
import { InspectionMapper } from '../mappers/inspection.mapper'
import { ImmutableInspectionError } from '../middleware/immutable.js'

// Mock service and mapper
vi.mock('../services/inspection.service')
vi.mock('../mappers/inspection.mapper')

// Create a test app with auth middleware mock
const createTestApp = () => {
  const testApp = new Hono()

  // Mock auth middleware
  testApp.use('*', async (c, next) => {
    c.set('userId', 'user-123')
    await next()
  })

  testApp.route('/', app)

  return testApp
}

describe('Inspections Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /', () => {
    it('should return user assigned inspections when no filters provided', async () => {
      const mockInspections = [
        {
          id: 'insp-1',
          permitId: 'permit-1',
          status: 'SCHEDULED',
        },
        {
          id: 'insp-2',
          permitId: 'permit-2',
          status: 'IN_PROGRESS',
        },
      ]

      const mockDTOs = [
        {
          id: 'insp-1',
          permitId: 'permit-1',
          permitNumber: 'P-2024-001',
          address: '123 Main St',
          status: 'SCHEDULED',
        },
        {
          id: 'insp-2',
          permitId: 'permit-2',
          permitNumber: 'P-2024-002',
          address: '456 Oak Ave',
          status: 'IN_PROGRESS',
        },
      ]

      vi.mocked(inspectionService.getAssigned).mockResolvedValue(mockInspections as any)
      vi.mocked(InspectionMapper.toListDTOs).mockReturnValue(mockDTOs as any)

      const testApp = createTestApp()
      const res = await testClient(testApp).index.$get({
        query: {},
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(mockDTOs)
      expect(inspectionService.getAssigned).toHaveBeenCalledWith('user-123', {
        limit: 20,
        offset: 0,
      })
    })

    it('should use list method when filters provided', async () => {
      const mockInspections = [
        {
          id: 'insp-1',
          permitId: 'permit-1',
          status: 'PASSED',
        },
      ]

      vi.mocked(inspectionService.list).mockResolvedValue(mockInspections as any)
      vi.mocked(InspectionMapper.toListDTOs).mockReturnValue([])

      const testApp = createTestApp()
      await testClient(testApp).index.$get({
        query: { status: 'PASSED' },
      })

      expect(inspectionService.list).toHaveBeenCalledWith({
        permitId: undefined,
        status: 'PASSED',
        assignedToId: undefined,
        limit: 20,
        offset: 0,
      })
    })

    it('should filter by permitId', async () => {
      vi.mocked(inspectionService.list).mockResolvedValue([])
      vi.mocked(InspectionMapper.toListDTOs).mockReturnValue([])

      const testApp = createTestApp()
      await testClient(testApp).index.$get({
        query: { permitId: 'permit-123' },
      })

      expect(inspectionService.list).toHaveBeenCalledWith(
        expect.objectContaining({
          permitId: 'permit-123',
        }),
      )
    })

    it('should filter by assignedInspectorId', async () => {
      vi.mocked(inspectionService.list).mockResolvedValue([])
      vi.mocked(InspectionMapper.toListDTOs).mockReturnValue([])

      const testApp = createTestApp()
      await testClient(testApp).index.$get({
        query: { assignedInspectorId: 'user-456' },
      })

      expect(inspectionService.list).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedToId: 'user-456',
        }),
      )
    })

    it('should apply pagination', async () => {
      vi.mocked(inspectionService.getAssigned).mockResolvedValue([])
      vi.mocked(InspectionMapper.toListDTOs).mockReturnValue([])

      const testApp = createTestApp()
      await testClient(testApp).index.$get({
        query: { limit: 10, offset: 20 },
      })

      expect(inspectionService.getAssigned).toHaveBeenCalledWith('user-123', {
        limit: 10,
        offset: 20,
      })
    })

    it('should return 500 on service error', async () => {
      vi.mocked(inspectionService.getAssigned).mockRejectedValue(new Error('Database error'))

      const testApp = createTestApp()
      const res = await testClient(testApp).index.$get({
        query: {},
      })

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })
  })

  describe('GET /:id', () => {
    it('should return inspection details', async () => {
      const mockInspection = {
        id: 'insp-123',
        permitId: 'permit-456',
        status: 'SCHEDULED',
      }

      const mockDTO = {
        id: 'insp-123',
        permitId: 'permit-456',
        status: 'SCHEDULED',
        scheduledDate: '2024-02-01T09:00:00.000Z',
      }

      vi.mocked(inspectionService.getById).mockResolvedValue(mockInspection as any)
      vi.mocked(InspectionMapper.toDTO).mockReturnValue(mockDTO as any)

      const testApp = createTestApp()
      const res = await testClient(testApp)[':id'].$get({
        param: { id: 'insp-123' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(mockDTO)
      expect(inspectionService.getById).toHaveBeenCalledWith('insp-123', 'user-123')
    })

    it('should return 404 if inspection not found', async () => {
      vi.mocked(inspectionService.getById).mockResolvedValue(null)

      const testApp = createTestApp()
      const res = await testClient(testApp)[':id'].$get({
        param: { id: 'non-existent' },
      })

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Inspection not found')
    })

    it('should return 403 if user unauthorized', async () => {
      vi.mocked(inspectionService.getById).mockRejectedValue(
        new Error('Unauthorized access to inspection'),
      )

      const testApp = createTestApp()
      const res = await testClient(testApp)[':id'].$get({
        param: { id: 'insp-123' },
      })

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })

    it('should return 500 on service error', async () => {
      vi.mocked(inspectionService.getById).mockRejectedValue(new Error('Database error'))

      const testApp = createTestApp()
      const res = await testClient(testApp)[':id'].$get({
        param: { id: 'insp-123' },
      })

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })
  })

  describe('POST /:id/start', () => {
    const validGPSCoords = {
      latitude: 51.0447,
      longitude: -114.0719,
      accuracy: 10,
      timestamp: '2024-02-01T10:00:00Z',
    }

    it('should start inspection successfully', async () => {
      const mockInspection = {
        id: 'insp-123',
        permitId: 'permit-456',
        status: 'IN_PROGRESS',
      }

      const mockDTO = {
        id: 'insp-123',
        permitId: 'permit-456',
        status: 'IN_PROGRESS',
        scheduledDate: '2024-02-01T09:00:00.000Z',
      }

      vi.mocked(inspectionService.start).mockResolvedValue(mockInspection as any)
      vi.mocked(InspectionMapper.toDTO).mockReturnValue(mockDTO as any)

      const testApp = createTestApp()
      const res = await testClient(testApp)[':id'].start.$post({
        param: { id: 'insp-123' },
        json: validGPSCoords,
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(mockDTO)
      expect(inspectionService.start).toHaveBeenCalledWith('insp-123', 'user-123', validGPSCoords)
    })

    it('should return 404 if inspection not found', async () => {
      vi.mocked(inspectionService.start).mockRejectedValue(new Error('Inspection not found'))

      const testApp = createTestApp()
      const res = await testClient(testApp)[':id'].start.$post({
        param: { id: 'non-existent' },
        json: validGPSCoords,
      })

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })

    it('should return 403 if user not assigned', async () => {
      vi.mocked(inspectionService.start).mockRejectedValue(
        new Error('User not assigned to this inspection'),
      )

      const testApp = createTestApp()
      const res = await testClient(testApp)[':id'].start.$post({
        param: { id: 'insp-123' },
        json: validGPSCoords,
      })

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })

    it('should return 400 if inspection in wrong status', async () => {
      vi.mocked(inspectionService.start).mockRejectedValue(
        new Error('Cannot start inspection with status IN_PROGRESS. Must be SCHEDULED.'),
      )

      const testApp = createTestApp()
      const res = await testClient(testApp)[':id'].start.$post({
        param: { id: 'insp-123' },
        json: validGPSCoords,
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })

    it('should return 500 on service error', async () => {
      vi.mocked(inspectionService.start).mockRejectedValue(new Error('Database error'))

      const testApp = createTestApp()
      const res = await testClient(testApp)[':id'].start.$post({
        param: { id: 'insp-123' },
        json: validGPSCoords,
      })

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })
  })

  describe('PATCH /:id (append-only)', () => {
    it('returns 409 when inspection is finalized', async () => {
      vi.mocked(inspectionService.update).mockRejectedValue(
        new ImmutableInspectionError(undefined, 'insp-final', 'update'),
      )

      const testApp = createTestApp()
      const res = await testClient(testApp)[':id'].$patch({
        param: { id: 'insp-final' },
        json: { notes: 'tamper' },
      })

      expect(res.status).toBe(409)
      const data = (await res.json()) as { code?: string }
      expect(data.code).toBe('IMMUTABLE_INSPECTION')
    })
  })

  describe('DELETE /:id (append-only)', () => {
    it('returns 409 when inspection is finalized', async () => {
      vi.mocked(inspectionService.delete).mockRejectedValue(
        new ImmutableInspectionError(undefined, 'insp-final', 'delete'),
      )

      const testApp = createTestApp()
      const res = await testClient(testApp)[':id'].$delete({
        param: { id: 'insp-final' },
      })

      expect(res.status).toBe(409)
    })
  })

  describe('POST /:id/addendum', () => {
    it('creates addendum on finalized inspection', async () => {
      vi.mocked(inspectionService.createAddendum).mockResolvedValue({
        id: 'add-1',
        inspectionId: 'insp-final',
        reason: 'Fix permit number',
        content: 'Corrected P-009',
        createdById: 'user-123',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        signature: null,
      })

      const testApp = createTestApp()
      const res = await testClient(testApp)[':id'].addendum.$post({
        param: { id: 'insp-final' },
        json: { reason: 'Fix permit number', content: 'Corrected P-009' },
      })

      expect(res.status).toBe(201)
      const data = (await res.json()) as { id: string }
      expect(data.id).toBe('add-1')
    })
  })
})
