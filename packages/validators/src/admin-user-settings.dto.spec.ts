import { describe, it, expect } from 'vitest'
import {
  AdminCreateUserBodySchema,
  AdminSsoSettingsPatchSchema,
  InspectionCertificationSnapshotSchema,
} from './admin-user-settings.dto'

describe('AdminCreateUserBodySchema', () => {
  it('accepts minimal SCO registration', () => {
    const result = AdminCreateUserBodySchema.safeParse({
      email: 'sco@example.com',
      name: 'Jane SCO',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.role).toBe('SCO')
    }
  })

  it('rejects invalid email', () => {
    const result = AdminCreateUserBodySchema.safeParse({
      email: 'not-an-email',
      name: 'Jane',
    })
    expect(result.success).toBe(false)
  })
})

describe('AdminSsoSettingsPatchSchema', () => {
  it('accepts partial patch', () => {
    expect(AdminSsoSettingsPatchSchema.safeParse({ enabled: true, clientId: 'abc' }).success).toBe(
      true,
    )
  })
})

describe('InspectionCertificationSnapshotSchema', () => {
  it('accepts snapshot payload', () => {
    const result = InspectionCertificationSnapshotSchema.safeParse({
      inspectionId: 'insp-1',
      snapshot: { finalizedAt: '2026-01-01T00:00:00.000Z', certifications: [] },
      snapshotHash: 'abc',
    })
    expect(result.success).toBe(true)
  })
})
