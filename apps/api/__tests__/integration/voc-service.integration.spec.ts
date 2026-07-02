import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'
import { VoCService } from '../../src/services/voc.service.js'

describe.sequential('VoCService integration (M10-S6)', () => {
  const service = new VoCService()
  let inspectorId: string
  let adminId: string
  let inspectionId: string
  let deficiencyId: string

  const submitDto = {
    verificationDate: '2026-11-02T12:00:00.000Z',
    sectionTitle: 'Division B — Safety',
    title: 'Guardrail corrected',
    name: 'Building Owner LLC',
    method: 'SITE_VISIT' as const,
    comments: 'Verified on site with photos on file.',
  }

  beforeAll(async () => {
    const inspector = await db.user.create({
      data: {
        email: `m10-s6-voc-insp-${Date.now()}@example.com`,
        name: 'M10 S6 Inspector',
        role: 'SCO',
      },
    })
    inspectorId = inspector.id

    const admin = await db.user.create({
      data: {
        email: `m10-s6-voc-admin-${Date.now()}@example.com`,
        name: 'M10 S6 Admin',
        role: 'ADMIN',
      },
    })
    adminId = admin.id

    const inspection = await db.permitInspection.create({
      data: {
        scheduledDate: new Date('2026-11-01'),
        status: 'IN_PROGRESS',
        notes: 'M10-S6 VoC service integration',
      },
    })
    inspectionId = inspection.id

    const deficiency = await db.deficiency.create({
      data: {
        clientId: `m10-s6-def-${Date.now()}`,
        inspectionId,
        createdById: inspectorId,
        description: 'Missing guardrail on stair',
        severity: 'MAJOR',
        status: 'OPEN',
      },
    })
    deficiencyId = deficiency.id
  })

  afterAll(async () => {
    await db.deficiency.deleteMany({ where: { inspectionId } })
    await db.permitInspection.deleteMany({ where: { id: inspectionId } })
    await db.user.deleteMany({ where: { id: { in: [inspectorId, adminId] } } })
  })

  beforeEach(async () => {
    await db.verificationOfCompliance.deleteMany({ where: { deficiencyId } })
    await db.deficiency.update({
      where: { id: deficiencyId },
      data: {
        status: 'OPEN',
        vocSubmittedAt: null,
        vocAcceptedAt: null,
        vocRejectedAt: null,
        vocNotes: null,
      },
    })
  })

  it('submit creates VoC linked to deficiency', async () => {
    const voc = await service.submit(deficiencyId, submitDto)

    expect(voc.status).toBe('PENDING')
    expect(voc.deficiencyId).toBe(deficiencyId)
    expect(voc.method).toBe('SITE_VISIT')

    const deficiency = await db.deficiency.findUniqueOrThrow({ where: { id: deficiencyId } })
    expect(deficiency.status).toBe('VOC_SUBMITTED')
    expect(deficiency.vocSubmittedAt).not.toBeNull()

    const byDef = await service.getByDeficiency(deficiencyId)
    expect(byDef?.id).toBe(voc.id)
  })

  it('review accept resolves deficiency', async () => {
    const voc = await service.submit(deficiencyId, submitDto)
    const reviewed = await service.review(voc.id, 'ACCEPTED', adminId)

    expect(reviewed.status).toBe('ACCEPTED')
    expect(reviewed.reviewedById).toBe(adminId)

    const deficiency = await db.deficiency.findUniqueOrThrow({ where: { id: deficiencyId } })
    expect(deficiency.status).toBe('CLOSED')
    expect(deficiency.vocAcceptedAt).not.toBeNull()
  })

  it('review reject allows resubmit', async () => {
    const voc = await service.submit(deficiencyId, submitDto)
    await service.review(voc.id, 'REJECTED', adminId)

    const deficiency = await db.deficiency.findUniqueOrThrow({ where: { id: deficiencyId } })
    expect(deficiency.status).toBe('VOC_REJECTED')

    const resubmitted = await service.submit(deficiencyId, {
      ...submitDto,
      comments: 'Additional evidence attached.',
    })
    expect(resubmitted.status).toBe('PENDING')
    expect(resubmitted.id).toBe(voc.id)

    const afterResubmit = await db.deficiency.findUniqueOrThrow({ where: { id: deficiencyId } })
    expect(afterResubmit.status).toBe('VOC_SUBMITTED')
  })
})
