import { describe, it, expect, beforeEach, vi } from 'vitest'
import { inspectionValidationService, type ValidationResult } from './inspection-validation.service'
import { prisma } from '@codecomply/db'

vi.mock('@codecomply/db', () => ({
  prisma: {
    permitInspection: {
      findUnique: vi.fn(),
    },
  },
}))

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function createTemplateItem(overrides?: Record<string, unknown>) {
  return {
    id: `item-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Item',
    required: true,
    requiresPhoto: true,
    ...overrides,
  }
}

function createResponse(
  itemId: string,
  result: 'PASS' | 'FAIL' | 'NA',
  extras?: Record<string, unknown>,
) {
  return {
    itemId,
    result,
    timestamp: '2024-02-01T10:00:00Z',
    ...extras,
  }
}

function createInspection(overrides?: Record<string, unknown>) {
  return {
    id: 'insp-123',
    status: 'PASSED',
    notes:
      'Started at: 2024-02-01T10:00:00Z\n[SIGNATURE_CAPTURED]\n[FINALIZATION_GPS] lat=51.04, lng=-114.07',
    scheduledDate: new Date('2024-02-01'),
    completedDate: null,
    permitId: 'permit-456',
    esiteId: null,
    lastSyncedAt: new Date(),
    etag: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    checklistExecutions: [],
    deficiencies: [],
    photos: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InspectionValidationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validate', () => {
    it('should return valid result for a complete inspection', async () => {
      const item1 = createTemplateItem({ id: 'item-1' })
      const item2 = createTemplateItem({ id: 'item-2', requiresPhoto: false })

      const inspection = createInspection({
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: [createResponse('item-1', 'PASS'), createResponse('item-2', 'PASS')],
            template: { id: 'tmpl-1', items: [item1, item2] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 100,
            completedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('should return invalid when inspection not found', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(null)

      const result = await inspectionValidationService.validate('non-existent')

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('INSPECTION_NOT_FOUND')
    })

    it('should collect errors from all validation rules', async () => {
      const item1 = createTemplateItem({ id: 'item-1' })

      const inspection = createInspection({
        status: 'IN_PROGRESS',
        notes: null,
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: [],
            template: { id: 'tmpl-1', items: [item1] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 0,
            completedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        deficiencies: [],
        photos: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.isValid).toBe(false)
      const codes = result.errors.map((e) => e.code)
      expect(codes).toContain('UNANSWERED_ITEMS')
      expect(codes).toContain('NO_OUTCOME')
      expect(codes).toContain('MISSING_SIGNATURE')
      expect(codes).toContain('MISSING_GPS')
    })
  })

  describe('validateAllItemsAnswered', () => {
    it('should error when no checklist execution exists', async () => {
      const inspection = createInspection({ checklistExecutions: [] })
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'NO_CHECKLIST')).toBe(true)
    })

    it('should error when some checklist items are unanswered', async () => {
      const item1 = createTemplateItem({ id: 'item-1' })
      const item2 = createTemplateItem({ id: 'item-2' })
      const item3 = createTemplateItem({ id: 'item-3' })

      const inspection = createInspection({
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: [createResponse('item-1', 'PASS')],
            template: { id: 'tmpl-1', items: [item1, item2, item3] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 33,
            completedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      const error = result.errors.find((e) => e.code === 'UNANSWERED_ITEMS')
      expect(error).toBeDefined()
      expect(error!.message).toContain('2 checklist item(s)')
    })

    it('should pass when all items are answered', async () => {
      const item1 = createTemplateItem({ id: 'item-1', requiresPhoto: false })
      const item2 = createTemplateItem({ id: 'item-2', requiresPhoto: false })

      const inspection = createInspection({
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: [createResponse('item-1', 'PASS'), createResponse('item-2', 'NA')],
            template: { id: 'tmpl-1', items: [item1, item2] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 100,
            completedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'UNANSWERED_ITEMS')).toBe(false)
      expect(result.errors.some((e) => e.code === 'NO_CHECKLIST')).toBe(false)
    })

    it('should skip templates with no item ids', async () => {
      const inspection = createInspection({
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: [],
            template: { id: 'tmpl-1', items: [{ title: 'Item without ID' }] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 100,
            completedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'UNANSWERED_ITEMS')).toBe(false)
    })

    it('should handle multiple checklist executions independently', async () => {
      const item1 = createTemplateItem({ id: 'item-1', requiresPhoto: false })
      const item2 = createTemplateItem({ id: 'item-2', requiresPhoto: false })

      const inspection = createInspection({
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: [createResponse('item-1', 'PASS')],
            template: { id: 'tmpl-1', items: [item1] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 100,
            completedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'exec-2',
            responses: [],
            template: { id: 'tmpl-2', items: [item2] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-2',
            versionHash: 'hash-2',
            progress: 0,
            completedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      const unansweredErrors = result.errors.filter((e) => e.code === 'UNANSWERED_ITEMS')
      expect(unansweredErrors).toHaveLength(1)
      expect(unansweredErrors[0].field).toContain('exec-2')
    })

    it('should handle malformed responses JSON gracefully', async () => {
      const item1 = createTemplateItem({ id: 'item-1' })

      const inspection = createInspection({
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: 'not-an-array',
            template: { id: 'tmpl-1', items: [item1] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 0,
            completedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'UNANSWERED_ITEMS')).toBe(true)
    })

    it('should handle malformed template items JSON gracefully', async () => {
      const inspection = createInspection({
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: [],
            template: { id: 'tmpl-1', items: 'not-an-array' },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 0,
            completedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'UNANSWERED_ITEMS')).toBe(false)
    })

    it('should handle null responses gracefully', async () => {
      const item1 = createTemplateItem({ id: 'item-1' })

      const inspection = createInspection({
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: null,
            template: { id: 'tmpl-1', items: [item1] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 0,
            completedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'UNANSWERED_ITEMS')).toBe(true)
    })

    it('should skip response rows with missing itemId or invalid result', async () => {
      const item1 = createTemplateItem({ id: 'item-1', requiresPhoto: false })
      const item2 = createTemplateItem({ id: 'item-2', requiresPhoto: false })

      const inspection = createInspection({
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: [
              { result: 'PASS', timestamp: '2024-01-01T00:00:00Z' },
              { itemId: 'item-1', result: 'INVALID', timestamp: '2024-01-01T00:00:00Z' },
              { itemId: 'item-1', result: 'PASS', timestamp: '2024-01-01T00:00:00Z' },
              null,
              42,
              { itemId: 'item-2', result: 'NA', notes: 123, timestamp: null },
            ],
            template: { id: 'tmpl-1', items: [item1, item2] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 100,
            completedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'UNANSWERED_ITEMS')).toBe(false)
    })
  })

  describe('validateRequiredPhotos', () => {
    it('should error when a failed item has no photo', async () => {
      const item1 = createTemplateItem({ id: 'item-1', requiresPhoto: true })

      const inspection = createInspection({
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: [
              createResponse('item-1', 'FAIL', {
                codeReference: { code: 'NBC', section: '9.10.1' },
              }),
            ],
            template: { id: 'tmpl-1', items: [item1] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 100,
            completedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        deficiencies: [],
        photos: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      const error = result.errors.find((e) => e.code === 'MISSING_PHOTO')
      expect(error).toBeDefined()
      expect(error!.field).toContain('item-1')
    })

    it('should pass when failed item has a photo via deficiency', async () => {
      const item1 = createTemplateItem({ id: 'item-1', requiresPhoto: true })

      const inspection = createInspection({
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: [
              createResponse('item-1', 'FAIL', {
                codeReference: { code: 'NBC', section: '9.10.1' },
              }),
            ],
            template: { id: 'tmpl-1', items: [item1] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 100,
            completedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        deficiencies: [
          {
            id: 'def-1',
            checklistItemId: 'item-1',
            photos: [{ id: 'photo-1' }],
            clientId: 'client-1',
            inspectionId: 'insp-123',
            createdById: 'user-1',
            description: 'Test deficiency',
            location: null,
            severity: 'MAJOR',
            status: 'OPEN',
            dueDate: null,
            codeReference: null,
            isStopWork: false,
            isUnsafe: false,
            vocSubmittedAt: null,
            vocAcceptedAt: null,
            vocRejectedAt: null,
            vocNotes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            syncedAt: null,
            etag: null,
            esiteId: null,
          },
        ],
        photos: [{ id: 'photo-1', deficiencyId: 'def-1' }],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'MISSING_PHOTO')).toBe(false)
    })

    it('should not require photo when requiresPhoto is false', async () => {
      const item1 = createTemplateItem({ id: 'item-1', requiresPhoto: false })

      const inspection = createInspection({
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: [
              createResponse('item-1', 'FAIL', {
                codeReference: { code: 'NBC', section: '9.10.1' },
              }),
            ],
            template: { id: 'tmpl-1', items: [item1] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 100,
            completedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        deficiencies: [],
        photos: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'MISSING_PHOTO')).toBe(false)
    })

    it('should not require photo for passed items', async () => {
      const item1 = createTemplateItem({ id: 'item-1', requiresPhoto: true })

      const inspection = createInspection({
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: [createResponse('item-1', 'PASS')],
            template: { id: 'tmpl-1', items: [item1] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 100,
            completedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        deficiencies: [],
        photos: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'MISSING_PHOTO')).toBe(false)
    })

    it('should not require photo for NA items', async () => {
      const item1 = createTemplateItem({ id: 'item-1', requiresPhoto: true })

      const inspection = createInspection({
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: [createResponse('item-1', 'NA')],
            template: { id: 'tmpl-1', items: [item1] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 100,
            completedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        deficiencies: [],
        photos: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'MISSING_PHOTO')).toBe(false)
    })

    it('should detect multiple missing photos across items', async () => {
      const item1 = createTemplateItem({ id: 'item-1', requiresPhoto: true })
      const item2 = createTemplateItem({ id: 'item-2', requiresPhoto: true })

      const inspection = createInspection({
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: [
              createResponse('item-1', 'FAIL', {
                codeReference: { code: 'NBC', section: '9.10.1' },
              }),
              createResponse('item-2', 'FAIL', {
                codeReference: { code: 'NBC', section: '9.10.2' },
              }),
            ],
            template: { id: 'tmpl-1', items: [item1, item2] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 100,
            completedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        deficiencies: [],
        photos: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      const photoErrors = result.errors.filter((e) => e.code === 'MISSING_PHOTO')
      expect(photoErrors).toHaveLength(2)
    })
  })

  describe('validateOutcomeSelected', () => {
    it('should error when status is IN_PROGRESS', async () => {
      const inspection = createInspection({
        status: 'IN_PROGRESS',
        checklistExecutions: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'NO_OUTCOME')).toBe(true)
    })

    it('should error when status is SCHEDULED', async () => {
      const inspection = createInspection({
        status: 'SCHEDULED',
        checklistExecutions: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'NO_OUTCOME')).toBe(true)
    })

    it('should error when status is CANCELLED', async () => {
      const inspection = createInspection({
        status: 'CANCELLED',
        checklistExecutions: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'NO_OUTCOME')).toBe(true)
    })

    it('should pass when status is PASSED', async () => {
      const inspection = createInspection({
        status: 'PASSED',
        checklistExecutions: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'NO_OUTCOME')).toBe(false)
    })

    it('should pass when status is FAILED', async () => {
      const inspection = createInspection({
        status: 'FAILED',
        checklistExecutions: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'NO_OUTCOME')).toBe(false)
    })
  })

  describe('validateSignaturePresent', () => {
    it('should error when notes is null', async () => {
      const inspection = createInspection({
        notes: null,
        checklistExecutions: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'MISSING_SIGNATURE')).toBe(true)
    })

    it('should error when notes does not contain signature marker', async () => {
      const inspection = createInspection({
        notes: 'Some notes without a signature\n[FINALIZATION_GPS] lat=51.04, lng=-114.07',
        checklistExecutions: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'MISSING_SIGNATURE')).toBe(true)
    })

    it('should pass when signature marker is present', async () => {
      const inspection = createInspection({
        notes: 'Notes\n[SIGNATURE_CAPTURED]\n[FINALIZATION_GPS] lat=51.04, lng=-114.07',
        checklistExecutions: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'MISSING_SIGNATURE')).toBe(false)
    })
  })

  describe('validateGPSCaptured', () => {
    it('should error when notes is null', async () => {
      const inspection = createInspection({
        notes: null,
        checklistExecutions: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'MISSING_GPS')).toBe(true)
    })

    it('should error when notes does not contain GPS marker', async () => {
      const inspection = createInspection({
        notes: 'Some notes\n[SIGNATURE_CAPTURED]',
        checklistExecutions: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'MISSING_GPS')).toBe(true)
    })

    it('should pass when GPS marker is present', async () => {
      const inspection = createInspection({
        notes: '[SIGNATURE_CAPTURED]\n[FINALIZATION_GPS] lat=51.04, lng=-114.07',
        checklistExecutions: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.errors.some((e) => e.code === 'MISSING_GPS')).toBe(false)
    })
  })

  describe('error messages', () => {
    it('should return clear error messages for each validation failure', async () => {
      const item1 = createTemplateItem({ id: 'item-1' })

      const inspection = createInspection({
        status: 'IN_PROGRESS',
        notes: null,
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: [
              createResponse('item-1', 'FAIL', {
                codeReference: { code: 'NBC', section: '9.10.1' },
              }),
            ],
            template: { id: 'tmpl-1', items: [item1] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 100,
            completedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        deficiencies: [],
        photos: [],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.isValid).toBe(false)

      for (const error of result.errors) {
        expect(error.code).toBeTruthy()
        expect(error.field).toBeTruthy()
        expect(error.message).toBeTruthy()
        expect(error.message.length).toBeGreaterThan(10)
      }
    })
  })

  describe('ValidationResult structure', () => {
    it('should always include isValid, errors, and warnings arrays', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(null)

      const result: ValidationResult = await inspectionValidationService.validate('any-id')

      expect(typeof result.isValid).toBe('boolean')
      expect(Array.isArray(result.errors)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
    })

    it('should have isValid=true only when errors array is empty', async () => {
      const item1 = createTemplateItem({ id: 'item-1', requiresPhoto: false })

      const inspection = createInspection({
        checklistExecutions: [
          {
            id: 'exec-1',
            responses: [createResponse('item-1', 'PASS')],
            template: { id: 'tmpl-1', items: [item1] },
            inspectionId: 'insp-123',
            templateId: 'tmpl-1',
            versionHash: 'hash-1',
            progress: 100,
            completedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      })

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(inspection as any)

      const result = await inspectionValidationService.validate('insp-123')

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })
})
