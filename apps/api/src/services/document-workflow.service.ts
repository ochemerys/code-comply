import { persistReportSignature, prisma } from '@codecomply/db'
import type { EmailInspectionDocumentDTO, SignInspectionDocumentDTO } from '@codecomply/validators'
import { buildMinimalDocxBuffer } from '../lib/docx/minimal-docx.js'
import { getEmailService } from '../lib/email/email-service.js'
import { AUDIT_ACTION, AUDIT_ENTITY, auditLogService } from './audit-log.service.js'
import { createObjectStorageClientFromEnv } from '../lib/storage/storage-client.js'
import { documentService, type Document } from './document.service.js'
import { distributionService } from './distribution.service.js'
import { inspectionService } from './inspection.service.js'
import { reportService, REPORT_SIGNED_URL_TTL_SECONDS } from './report.service.js'

export type DocumentEmailResult = {
  documentId: string
  status: 'sent' | 'failed'
  messageId?: string
  error?: string
}

export class DocumentWorkflowService {
  async emailInspectionDocument(
    documentId: string,
    body: EmailInspectionDocumentDTO,
    userId: string,
  ): Promise<DocumentEmailResult> {
    const doc = await documentService.getById(documentId)
    if (!doc) {
      throw new Error('Document not found')
    }

    const inspection = await inspectionService.getById(doc.inspectionId, userId)
    if (!inspection) {
      throw new Error('Inspection not found')
    }

    const permitNumber =
      (inspection as { permit?: { permitNumber?: string } | null }).permit?.permitNumber ?? 'N/A'
    const storage = createObjectStorageClientFromEnv()
    const fileBytes = await storage.getObjectBytes('documents', doc.storageKey)

    try {
      const delivery = await getEmailService().sendTemplated({
        to: body.to,
        template: 'inspection-report',
        context: {
          permitNumber,
          inspectionId: doc.inspectionId,
          recipientName: 'Recipient',
          customMessage: body.message ?? '',
        },
        attachments: [
          {
            filename: doc.filename,
            content: Buffer.from(fileBytes),
            type: doc.mimeType,
          },
        ],
      })

      await auditLogService.append({
        entityType: AUDIT_ENTITY.INSPECTION_DOCUMENT,
        entityId: doc.id,
        action: AUDIT_ACTION.DOCUMENT_EMAILED,
        userId,
        metadata: {
          inspectionId: doc.inspectionId,
          recipients: body.to,
          messageId: delivery.messageId,
        },
      })

      return { documentId, status: 'sent', messageId: delivery.messageId }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email failed'
      return { documentId, status: 'failed', error: message }
    }
  }

  async signInspectionDocument(
    documentId: string,
    body: SignInspectionDocumentDTO,
    userId: string,
  ): Promise<Document> {
    const doc = await documentService.getById(documentId)
    if (!doc) {
      throw new Error('Document not found')
    }

    const inspection = await inspectionService.getById(doc.inspectionId, userId)
    if (!inspection) {
      throw new Error('Inspection not found')
    }

    const signedAt = new Date().toISOString()
    const nextMeta: Record<string, unknown> = {
      ...doc.metadata,
      signatureDataUrl: body.signatureDataUrl,
      signedAt,
      signedByUserId: userId,
      ...(body.signedByName ? { signedByName: body.signedByName } : {}),
    }

    const { inspectionDocumentDelegate } = await import('@codecomply/db')
    const row = await inspectionDocumentDelegate.update({
      where: { id: documentId },
      data: { metadata: nextMeta },
    })

    await auditLogService.append({
      entityType: AUDIT_ENTITY.INSPECTION_DOCUMENT,
      entityId: documentId,
      action: AUDIT_ACTION.DOCUMENT_SIGNED,
      userId,
      metadata: { inspectionId: doc.inspectionId, signedAt },
    })

    return {
      id: row.id,
      inspectionId: row.inspectionId,
      filename: row.filename,
      mimeType: row.mimeType,
      size: row.size,
      storageKey: row.storageKey,
      metadata:
        typeof row.metadata === 'object' && row.metadata !== null && !Array.isArray(row.metadata)
          ? { ...(row.metadata as Record<string, unknown>) }
          : {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  async signReport(
    reportId: string,
    body: SignInspectionDocumentDTO,
    userId: string,
  ): Promise<void> {
    const report = await reportService.getById(reportId)
    if (!report) {
      throw new Error('Report not found')
    }

    const inspection = await inspectionService.getById(report.inspectionId, userId)
    if (!inspection) {
      throw new Error('Inspection not found')
    }

    await persistReportSignature(reportId, {
      signedAt: new Date(),
      signatureImage: body.signatureDataUrl,
      signedByUserId: userId,
    })

    await auditLogService.append({
      entityType: AUDIT_ENTITY.REPORT,
      entityId: reportId,
      action: AUDIT_ACTION.REPORT_SIGNED,
      userId,
      metadata: {
        inspectionId: report.inspectionId,
        signedByName: body.signedByName ?? null,
      },
    })
  }

  /** Resolve contacts for document hub email defaults. */
  getDistributionContacts(inspectionId: string) {
    return distributionService.getContactsForInspection(inspectionId)
  }
}

export const documentWorkflowService = new DocumentWorkflowService()

/** Word export for a stored report PDF metadata summary. */
export async function ensureReportDocxExport(reportId: string): Promise<{
  storageKey: string
  filename: string
}> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { inspection: { include: { permit: true } } },
  })
  if (!report) {
    throw new Error('Report not found')
  }

  const docxKey = `${report.storageKey.replace(/\.pdf$/i, '')}.docx`
  const storage = createObjectStorageClientFromEnv()

  try {
    await storage.getObjectBytes('documents', docxKey)
  } catch {
    const permitNumber = report.inspection.permit?.permitNumber ?? 'N/A'
    const paragraphs = [
      `Report type: ${report.type}`,
      `Permit: ${permitNumber}`,
      `Inspection: ${report.inspectionId}`,
      `Generated: ${report.generatedAt.toISOString()}`,
      `Document hash: ${report.hash}`,
      '',
      'This Word export is a text summary. Open the PDF for the full formatted report.',
    ]
    const buffer = buildMinimalDocxBuffer(paragraphs)
    await storage.putObject(
      'documents',
      docxKey,
      buffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
  }
  return { storageKey: docxKey, filename: report.filename.replace(/\.pdf$/i, '.docx') }
}

export async function getReportSignedDownloadUrl(
  reportId: string,
  format: 'pdf' | 'docx',
): Promise<string> {
  if (format === 'pdf') {
    return reportService.getSignedDownloadUrl(reportId)
  }
  const { storageKey } = await ensureReportDocxExport(reportId)
  const storage = createObjectStorageClientFromEnv()
  return storage.getSignedGetUrl('documents', storageKey, REPORT_SIGNED_URL_TTL_SECONDS)
}
