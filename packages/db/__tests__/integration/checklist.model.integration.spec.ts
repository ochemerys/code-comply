/**
 * Unit tests for checklist schema (M5-S1): ChecklistTemplate, ChecklistExecution, CodeLibrary
 */

import { describe, it, expect, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

/** Same pattern as `__tests__/helpers/test-prisma.ts` — `photo` may be missing on `PrismaClient` in some TS resolutions. */
const prisma = new PrismaClient() as PrismaClient & {
  photo: { deleteMany: (args?: { where?: object }) => Promise<unknown> }
}

async function cleanupChecklistData() {
  await prisma.checklistExecution.deleteMany()
  await prisma.checklistTemplate.deleteMany()
  await prisma.codeLibrary.deleteMany()
  await prisma.inspectionSchedule.deleteMany()
  await prisma.photo.deleteMany()
  await prisma.deficiency.deleteMany()
  await prisma.permitInspection.deleteMany()
  await prisma.permit.deleteMany()
}

describe('Checklist schema (M5-S1)', () => {
  afterEach(async () => {
    await cleanupChecklistData()
  })

  describe('ChecklistTemplate', () => {
    it('creates a template with versioning and unique versionHash', async () => {
      const items = [{ id: 'q1', label: 'Foundation', order: 1 }]
      const template = await prisma.checklistTemplate.create({
        data: {
          name: 'Building — Part 9',
          discipline: 'Building',
          version: 1,
          versionHash: 'sha256:abc123def456',
          items,
          isActive: true,
        },
      })

      expect(template.id).toBeDefined()
      expect(template.name).toBe('Building — Part 9')
      expect(template.discipline).toBe('Building')
      expect(template.version).toBe(1)
      expect(template.versionHash).toBe('sha256:abc123def456')
      expect(template.items).toEqual(items)
      expect(template.isActive).toBe(true)
    })

    it('rejects duplicate versionHash', async () => {
      const hash = 'sha256:duplicate'
      await prisma.checklistTemplate.create({
        data: {
          name: 'T1',
          discipline: 'Building',
          versionHash: hash,
          items: [],
        },
      })

      await expect(
        prisma.checklistTemplate.create({
          data: {
            name: 'T2',
            discipline: 'Plumbing',
            versionHash: hash,
            items: [],
          },
        }),
      ).rejects.toThrow()
    })

    it('defaults version to 1 and isActive to true', async () => {
      const t = await prisma.checklistTemplate.create({
        data: {
          name: 'Defaulted',
          discipline: 'Electrical',
          versionHash: 'sha256:unique-default',
          items: [],
        },
      })
      expect(t.version).toBe(1)
      expect(t.isActive).toBe(true)
    })
  })

  describe('CodeLibrary', () => {
    it('enforces unique (code, section)', async () => {
      await prisma.codeLibrary.create({
        data: {
          code: 'NBC',
          section: '9.10.1',
          title: 'Fire separation',
        },
      })

      await expect(
        prisma.codeLibrary.create({
          data: {
            code: 'NBC',
            section: '9.10.1',
            title: 'Duplicate row',
          },
        }),
      ).rejects.toThrow()
    })

    it('allows same code with different section', async () => {
      await prisma.codeLibrary.create({
        data: { code: 'NBC', section: '9.10.1', title: 'A' },
      })
      const second = await prisma.codeLibrary.create({
        data: { code: 'NBC', section: '9.10.2', title: 'B' },
      })
      expect(second.section).toBe('9.10.2')
    })
  })

  describe('ChecklistExecution', () => {
    async function seedInspectionAndTemplate() {
      const permit = await prisma.permit.create({
        data: {
          permitNumber: 'M5-S1-UNIT-001',
          address: '1 Test Way',
          scope: 'Test',
        },
      })
      const inspection = await prisma.permitInspection.create({
        data: {
          permitId: permit.id,
          scheduledDate: new Date('2026-04-01'),
          status: 'IN_PROGRESS',
        },
      })
      const template = await prisma.checklistTemplate.create({
        data: {
          name: 'Field checklist',
          discipline: 'Building',
          versionHash: 'sha256:exec-template',
          items: [{ id: 'i1' }],
        },
      })
      return { inspection, template }
    }

    it('tracks inspection progress with JSON responses', async () => {
      const { inspection, template } = await seedInspectionAndTemplate()
      const responses = { i1: { status: 'PASS', at: '2026-03-29T12:00:00Z' } }

      const exec = await prisma.checklistExecution.create({
        data: {
          inspectionId: inspection.id,
          templateId: template.id,
          versionHash: template.versionHash,
          responses,
          progress: 0.5,
        },
      })

      expect(exec.progress).toBe(0.5)
      expect(exec.responses).toEqual(responses)
      expect(exec.completedAt).toBeNull()
    })

    it('links to inspection and template relations', async () => {
      const { inspection, template } = await seedInspectionAndTemplate()
      await prisma.checklistExecution.create({
        data: {
          inspectionId: inspection.id,
          templateId: template.id,
          versionHash: template.versionHash,
          responses: {},
          progress: 0,
        },
      })

      const loaded = await prisma.permitInspection.findUnique({
        where: { id: inspection.id },
        include: {
          checklistExecutions: { include: { template: true } },
        },
      })

      expect(loaded?.checklistExecutions).toHaveLength(1)
      expect(loaded?.checklistExecutions[0].template.name).toBe('Field checklist')
    })

    it('cascades delete when inspection is removed', async () => {
      const { inspection, template } = await seedInspectionAndTemplate()
      const exec = await prisma.checklistExecution.create({
        data: {
          inspectionId: inspection.id,
          templateId: template.id,
          versionHash: template.versionHash,
          responses: {},
          progress: 0,
        },
      })

      await prisma.permitInspection.delete({ where: { id: inspection.id } })

      const gone = await prisma.checklistExecution.findUnique({ where: { id: exec.id } })
      expect(gone).toBeNull()

      const tpl = await prisma.checklistTemplate.findUnique({ where: { id: template.id } })
      expect(tpl).not.toBeNull()
    })
  })
})
