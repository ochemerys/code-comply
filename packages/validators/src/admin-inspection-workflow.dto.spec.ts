import { describe, it, expect } from 'vitest'
import {
  AdminInspectionWorkflowDetailSchema,
  InspectionWorkflowSyncPayloadSchema,
  InspectorUnableToEnterRequestSchema,
  UpdateAdminInspectionWorkflowSchema,
} from './admin-inspection-workflow.dto.js'

describe('admin-inspection-workflow.dto', () => {
  it('parses workflow detail', () => {
    const result = AdminInspectionWorkflowDetailSchema.safeParse({
      inspectionId: 'insp-1',
      permitNumber: 'P-1',
      address: '123 Main',
      status: 'IN_PROGRESS',
      isFinalized: false,
      stages: ['FINAL'],
      noFurtherInspectionsRequired: false,
      reInspectionFeeFlagged: false,
      permitReInspectionFeeFlagged: false,
    })
    expect(result.success).toBe(true)
  })

  it('requires Other description when OTHER stage selected', () => {
    const result = UpdateAdminInspectionWorkflowSchema.safeParse({
      stages: ['OTHER'],
      otherStageDescription: '',
    })
    expect(result.success).toBe(false)
  })

  it('parses sync payload with unable to enter', () => {
    const result = InspectionWorkflowSyncPayloadSchema.safeParse({
      inspectionId: 'insp-1',
      unableToEnter: {
        firstNotificationDate: '2026-01-15T12:00:00.000Z',
        geofenceProof: { latitude: 53.5, longitude: -113.5, accuracy: 12 },
      },
    })
    expect(result.success).toBe(true)
  })

  it('parses inspector unable-to-enter request', () => {
    const result = InspectorUnableToEnterRequestSchema.safeParse({
      attemptAt: '2026-06-10T10:15:00.000Z',
      comments: 'Gate locked; no adult present',
      geofenceProof: { latitude: 53.6123, longitude: -113.7234, accuracy: 8 },
    })
    expect(result.success).toBe(true)
  })
})
