import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DocumentWorkflowService } from './document-workflow.service.js'

vi.mock('../lib/email/email-service.js', () => ({
  getEmailService: () => ({
    sendTemplated: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
  }),
}))

vi.mock('../lib/storage/storage-client.js', () => ({
  createObjectStorageClientFromEnv: () => ({
    getObjectBytes: vi.fn().mockResolvedValue(Buffer.from('pdf')),
    putObject: vi.fn().mockResolvedValue(undefined),
    getSignedGetUrl: vi.fn().mockResolvedValue('https://signed/docx'),
  }),
}))

vi.mock('./document.service.js', () => ({
  documentService: {
    getById: vi.fn(),
  },
}))

vi.mock('./inspection.service.js', () => ({
  inspectionService: {
    getById: vi.fn(),
  },
}))

vi.mock('./audit-log.service.js', () => ({
  auditLogService: { append: vi.fn().mockResolvedValue(undefined) },
  AUDIT_ENTITY: { INSPECTION_DOCUMENT: 'InspectionDocument', REPORT: 'Report' },
  AUDIT_ACTION: { DOCUMENT_EMAILED: 'DOCUMENT_EMAILED', DOCUMENT_SIGNED: 'DOCUMENT_SIGNED' },
}))

vi.mock('@codecomply/db', () => ({
  inspectionDocumentDelegate: {
    update: vi.fn().mockResolvedValue({
      id: 'doc-1',
      inspectionId: 'insp-1',
      filename: 'a.pdf',
      mimeType: 'application/pdf',
      size: 10,
      storageKey: 'k',
      metadata: { signedAt: '2026-01-01T00:00:00.000Z' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  },
  prisma: { report: { findUnique: vi.fn(), update: vi.fn() } },
}))

import { documentService } from './document.service.js'
import { inspectionService } from './inspection.service.js'

describe('DocumentWorkflowService', () => {
  let service: DocumentWorkflowService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DocumentWorkflowService()
  })

  it('emails document when inspection is accessible', async () => {
    vi.mocked(documentService.getById).mockResolvedValue({
      id: 'doc-1',
      inspectionId: 'insp-1',
      filename: 'plan.pdf',
      mimeType: 'application/pdf',
      size: 100,
      storageKey: 'insp-1/key',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(inspectionService.getById).mockResolvedValue({
      id: 'insp-1',
      permit: { permitNumber: 'P-1' },
    } as never)

    const result = await service.emailInspectionDocument(
      'doc-1',
      { to: ['owner@example.com'] },
      'admin-1',
    )
    expect(result.status).toBe('sent')
  })
})
