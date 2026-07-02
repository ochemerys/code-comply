import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  permitInspection: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  inspectionWorkflow: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  permit: {
    update: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: typeof prismaMock) => Promise<void>) => fn(prismaMock)),
}

vi.mock('@codecomply/db', () => ({ prisma: prismaMock }))

const { InspectionWorkflowService } = await import('./inspection-workflow.service.js')

describe('InspectionWorkflowService', () => {
  const service = new InspectionWorkflowService()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getAdminDetail returns null when inspection missing', async () => {
    prismaMock.permitInspection.findUnique.mockResolvedValue(null)
    const detail = await service.getAdminDetail('missing')
    expect(detail).toBeNull()
  })
})
