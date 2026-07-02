import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DocumentWorkflowService } from '../../src/services/document-workflow.service.js'

vi.mock('../../src/lib/email/email-service.js', () => ({
  getEmailService: () => ({
    sendTemplated: vi.fn().mockResolvedValue({ messageId: 'msg-test' }),
  }),
}))

vi.mock('../../src/lib/storage/storage-client.js', () => ({
  createObjectStorageClientFromEnv: () => ({
    getObjectBytes: vi.fn().mockResolvedValue(Buffer.from('%PDF')),
  }),
}))

vi.mock('../../src/services/document.service.js', () => ({
  documentService: {
    getById: vi.fn(),
  },
}))

vi.mock('../../src/services/inspection.service.js', () => ({
  inspectionService: {
    getById: vi.fn(),
  },
}))

vi.mock('../../src/services/audit-log.service.js', () => ({
  auditLogService: { append: vi.fn().mockResolvedValue(undefined) },
  AUDIT_ENTITY: { INSPECTION_DOCUMENT: 'InspectionDocument' },
  AUDIT_ACTION: { DOCUMENT_EMAILED: 'DOCUMENT_EMAILED' },
}))

import { documentService } from '../../src/services/document.service.js'
import { inspectionService } from '../../src/services/inspection.service.js'
import { auditLogService, AUDIT_ACTION } from '../../src/services/audit-log.service.js'

describe('Admin document workflow (integration)', () => {
  const service = new DocumentWorkflowService()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records audit log when document email succeeds', async () => {
    vi.mocked(documentService.getById).mockResolvedValue({
      id: 'doc-1',
      inspectionId: 'insp-1',
      filename: 'plan.pdf',
      mimeType: 'application/pdf',
      size: 4,
      storageKey: 'k',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(inspectionService.getById).mockResolvedValue({
      id: 'insp-1',
      permit: { permitNumber: 'P-99' },
    } as never)

    const result = await service.emailInspectionDocument(
      'doc-1',
      { to: ['owner@example.com'], message: 'Review attached' },
      'admin-1',
    )

    expect(result.status).toBe('sent')
    expect(auditLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTION.DOCUMENT_EMAILED }),
    )
  })
})
