import type { PrismaClient } from '@prisma/client'
import { expect } from '@playwright/test'
import type { IWorld } from '../step-definitions/world'

/** Matches ChecklistExecutionView.spec / M5-S18 E2E expectations. */
export const E2E_CHECKLIST_ITEMS = [
  {
    id: 'item-1',
    order: 1,
    text: 'Fire separation maintained between units',
    category: 'Fire',
    isRequired: true,
    requiresPhoto: true,
    codeReferences: [{ code: 'NBC', section: '9.10.1' }],
  },
  {
    id: 'item-2',
    order: 2,
    text: 'Exit signs illuminated',
    category: 'Fire',
    isRequired: true,
    requiresPhoto: false,
    codeReferences: [{ code: 'NBC', section: '3.4.1' }],
  },
  {
    id: 'item-3',
    order: 3,
    text: 'Handrails and guards secure',
    category: 'Building',
    isRequired: true,
    requiresPhoto: false,
    codeReferences: [{ code: 'NBC', section: '9.8.8' }],
  },
  {
    id: 'item-4',
    order: 4,
    text: 'Optional advisory — accessibility route',
    category: 'Building',
    isRequired: false,
    requiresPhoto: false,
    codeReferences: [{ code: 'NBC', section: '3.8.1' }],
  },
] as const

export type ChecklistWorkflowRef = {
  inspectionId: string
  executionId: string
}

const workflowCache = new Map<string, ChecklistWorkflowRef>()

export async function seedChecklistWorkflow(
  prisma: PrismaClient,
  workflowKey: string,
): Promise<ChecklistWorkflowRef> {
  const cached = workflowCache.get(workflowKey)
  if (cached) {
    const stillExists = await prisma.checklistExecution.findUnique({
      where: { id: cached.executionId },
    })
    if (stillExists) return cached
    workflowCache.delete(workflowKey)
  }

  const inspector = await prisma.user.findUniqueOrThrow({
    where: { email: 'test-inspector@example.com' },
  })

  const versionHash = `sha256:e2e-${workflowKey.replace(/[^a-z0-9]+/gi, '-').slice(0, 48)}`
  let template = await prisma.checklistTemplate.findUnique({ where: { versionHash } })
  if (!template) {
    template = await prisma.checklistTemplate.create({
      data: {
        name: 'E2E browser checklist',
        discipline: 'Building',
        version: 1,
        versionHash,
        isActive: true,
        items: [...E2E_CHECKLIST_ITEMS],
      },
    })
  }

  const inspection = await prisma.permitInspection.create({
    data: {
      scheduledDate: new Date('2026-08-15T12:00:00.000Z'),
      status: 'IN_PROGRESS',
      notes: `E2E checklist workflow ${workflowKey}`,
    },
  })

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection.id,
      assignedToId: inspector.id,
    },
  })

  const execution = await prisma.checklistExecution.create({
    data: {
      inspectionId: inspection.id,
      templateId: template.id,
      versionHash: template.versionHash,
      responses: [],
      progress: 0,
    },
  })

  const ref = { inspectionId: inspection.id, executionId: execution.id }
  workflowCache.set(workflowKey, ref)
  return ref
}

export async function openChecklistExecutionPage(
  world: IWorld,
  workflowKey: string,
  viewport: { width: number; height: number } = { width: 390, height: 844 },
): Promise<ChecklistWorkflowRef> {
  const prisma = world.testDb.getClient()
  const { inspectionId, executionId } = await seedChecklistWorkflow(prisma, workflowKey)

  await world.page.setViewportSize(viewport)
  const url = `${world.getInspectorUrl()}/inspections/${encodeURIComponent(inspectionId)}/checklist/${encodeURIComponent(executionId)}`
  await world.page.goto(url)
  await expect(world.page.getByTestId('checklist-execution-view')).toBeVisible({ timeout: 25_000 })
  await expect(world.page.getByTestId('checklist-pass-item-1')).toBeVisible({ timeout: 20_000 })

  return { inspectionId, executionId }
}
