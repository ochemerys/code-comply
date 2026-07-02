import { prisma } from '@codecomply/db'
import type {
  Deficiency,
  Permit,
  PermitInspection,
  Report,
  VerificationOfCompliance,
} from '@codecomply/db'
import type { ReportDistributionRecipientDTO } from '@codecomply/validators'
import type { EmailTemplateId } from '../lib/email/email-types.js'
import type { EmailService } from '../lib/email/email-service.js'
import { getEmailService } from '../lib/email/email-service.js'
import type { ReportStorage } from './report.service.js'
import { reportService, ReportService } from './report.service.js'
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  auditLogService,
  type AuditLogService,
} from './audit-log.service.js'
import { createObjectStorageClientFromEnv } from '../lib/storage/storage-client.js'

export type DistributionKind =
  | 'inspection-report'
  | 'deficiency-notice'
  | 'stop-work-order'
  | 'voc-decision'

export type DistributionTrigger = 'sync' | 'manual'

export type DistributionResult = {
  kind: DistributionKind
  status: 'sent' | 'skipped' | 'failed'
  inspectionId: string
  entityId?: string
  messageId?: string
  error?: string
  reason?: string
}

export type DistributionBatchResult = {
  inspectionId: string
  trigger: DistributionTrigger
  results: DistributionResult[]
}

type InspectionContext = PermitInspection & {
  permit: Permit | null
  schedule: { assignedTo: { email: string; name: string } | null } | null
  deficiencies: (Deficiency & { verificationOfCompliance: VerificationOfCompliance | null })[]
  reports: Report[]
}

type StakeholderContacts = {
  ownerEmail: string
  contractorEmail: string
  inspectorEmail?: string
  submitterEmail: string
}

export type DistributionServiceDeps = {
  reportService?: ReportService
  emailService?: EmailService
  storage?: ReportStorage
  auditLog?: AuditLogService
  maxRetries?: number
  retryDelayMs?: number
  sleepFn?: (ms: number) => Promise<void>
}

const DEFAULT_MAX_RETRIES = 3
const DEFAULT_RETRY_DELAY_MS = 50

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class DistributionService {
  private readonly reportSvc: ReportService
  private readonly injectedEmail?: EmailService
  private readonly injectedStorage?: ReportStorage
  private readonly audit: AuditLogService
  private readonly maxRetries: number
  private readonly retryDelayMs: number
  private readonly sleepFn: (ms: number) => Promise<void>

  constructor(deps: DistributionServiceDeps = {}) {
    this.reportSvc = deps.reportService ?? reportService
    this.injectedEmail = deps.emailService
    this.injectedStorage = deps.storage
    this.audit = deps.auditLog ?? auditLogService
    this.maxRetries = deps.maxRetries ?? DEFAULT_MAX_RETRIES
    this.retryDelayMs = deps.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
    this.sleepFn = deps.sleepFn ?? sleep
  }

  private get emailSvc(): EmailService {
    if (this.injectedEmail) return this.injectedEmail
    return getEmailService()
  }

  private get storage(): ReportStorage {
    if (this.injectedStorage) return this.injectedStorage
    return createObjectStorageClientFromEnv() as unknown as ReportStorage
  }

  async onSyncPushComplete(
    inspectionIds: string[],
    userId: string,
  ): Promise<DistributionBatchResult[]> {
    const batches: DistributionBatchResult[] = []
    for (const inspectionId of [...new Set(inspectionIds)]) {
      batches.push(await this.distributeForInspection(inspectionId, userId, 'sync'))
    }
    return batches
  }

  async getContactsForInspection(inspectionId: string): Promise<StakeholderContacts> {
    const inspection = await this.loadInspectionContext(inspectionId)
    if (!inspection) {
      throw new Error('Inspection not found')
    }
    return this.resolveContacts(inspection)
  }

  async distributeReportByEmail(input: {
    reportId: string
    recipientKeys: ReportDistributionRecipientDTO[]
    customEmails: string[]
    userId: string
  }): Promise<{
    status: 'sent' | 'failed'
    messageId?: string
    error?: string
    distributedAt: string | null
  }> {
    const report = await prisma.report.findUnique({
      where: { id: input.reportId },
      include: { inspection: { include: { permit: true } } },
    })
    if (!report) {
      throw new Error('Report not found')
    }

    const inspection = await this.loadInspectionContext(report.inspectionId)
    if (!inspection) {
      throw new Error('Inspection not found')
    }

    const contacts = await this.resolveContacts(inspection)
    const emails = new Set<string>()

    for (const key of input.recipientKeys) {
      if (key === 'owner') emails.add(contacts.ownerEmail)
      if (key === 'contractor') emails.add(contacts.contractorEmail)
      if (key === 'inspector' && contacts.inspectorEmail) emails.add(contacts.inspectorEmail)
    }
    for (const email of input.customEmails) {
      emails.add(email)
    }

    if (emails.size === 0) {
      throw new Error('At least one recipient email is required')
    }

    const template = this.templateForReportType(report.type)
    const kind = this.kindForReportType(report.type)

    try {
      const pdf = await this.storage.getObjectBytes('documents', report.storageKey)
      const delivery = await this.sendWithRetry({
        to: [...emails],
        template,
        context: {
          permitNumber: report.inspection.permit?.permitNumber ?? 'N/A',
          inspectionId: report.inspectionId,
          recipientName: 'Stakeholder',
          deficiencyDescription:
            report.type === 'STOP_WORK' || report.type === 'DEFICIENCY'
              ? 'See attached order / notice'
              : undefined,
          issuedAt: report.generatedAt.toISOString(),
        },
        attachments: [
          {
            filename: report.filename,
            content: Buffer.from(pdf),
            type: 'application/pdf',
          },
        ],
      })

      await this.markReportDistributed(report.id)
      await this.logDistributionSuccess({
        entityType: AUDIT_ENTITY.REPORT,
        entityId: report.id,
        inspectionId: report.inspectionId,
        userId: input.userId,
        kind,
        messageId: delivery.messageId,
      })

      const updated = await prisma.report.findUnique({ where: { id: report.id } })
      return {
        status: 'sent',
        messageId: delivery.messageId,
        distributedAt: updated?.distributedAt?.toISOString() ?? new Date().toISOString(),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await this.failResult(
        kind,
        report.inspectionId,
        error,
        input.userId,
        AUDIT_ENTITY.REPORT,
        report.id,
      )
      return {
        status: 'failed',
        error: message,
        distributedAt: report.distributedAt?.toISOString() ?? null,
      }
    }
  }

  private templateForReportType(type: Report['type']): EmailTemplateId {
    switch (type) {
      case 'STOP_WORK':
        return 'stop-work-order'
      case 'DEFICIENCY':
        return 'deficiency-notice'
      case 'NO_ENTRY':
        return 'inspection-report'
      default:
        return 'inspection-report'
    }
  }

  private kindForReportType(type: Report['type']): DistributionKind {
    switch (type) {
      case 'STOP_WORK':
        return 'stop-work-order'
      case 'DEFICIENCY':
        return 'deficiency-notice'
      default:
        return 'inspection-report'
    }
  }

  async distributeManually(inspectionId: string, userId: string): Promise<DistributionBatchResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (!user || user.role !== 'ADMIN') {
      throw new Error('Forbidden: only admins can trigger manual distribution')
    }
    return this.distributeForInspection(inspectionId, userId, 'manual', true)
  }

  async distributeForInspection(
    inspectionId: string,
    userId: string,
    trigger: DistributionTrigger,
    force = false,
  ): Promise<DistributionBatchResult> {
    const inspection = await this.loadInspectionContext(inspectionId)
    if (!inspection) {
      throw new Error('Inspection not found')
    }

    const contacts = await this.resolveContacts(inspection)
    const results: DistributionResult[] = []

    results.push(await this.distributeInspectionReport(inspection, contacts, userId, force))

    for (const deficiency of inspection.deficiencies) {
      if (deficiency.status === 'OPEN') {
        results.push(
          await this.distributeDeficiencyNotice(inspection, deficiency, contacts, userId, force),
        )
      }
      if (deficiency.isStopWork) {
        results.push(
          await this.distributeStopWorkOrder(inspection, deficiency, contacts, userId, force),
        )
      }
      const voc = deficiency.verificationOfCompliance
      if (voc && (voc.status === 'ACCEPTED' || voc.status === 'REJECTED')) {
        results.push(
          await this.distributeVoCDecision(inspection, deficiency, voc, contacts, userId, force),
        )
      }
    }

    return { inspectionId, trigger, results }
  }

  private async distributeInspectionReport(
    inspection: InspectionContext,
    contacts: StakeholderContacts,
    userId: string,
    force: boolean,
  ): Promise<DistributionResult> {
    const kind: DistributionKind = 'inspection-report'
    if (!this.isInspectionReadyForReport(inspection)) {
      return {
        kind,
        status: 'skipped',
        inspectionId: inspection.id,
        reason: 'Inspection not finalized',
      }
    }

    if (!force && (await this.wasDistributed(AUDIT_ENTITY.REPORT, inspection.id, kind))) {
      return {
        kind,
        status: 'skipped',
        inspectionId: inspection.id,
        reason: 'Already distributed',
      }
    }

    try {
      let report =
        inspection.reports.find((r) => r.type === 'INSPECTION' && !r.distributedAt) ??
        inspection.reports.find((r) => r.type === 'INSPECTION')

      if (!report || force) {
        report = await this.reportSvc.generateAndStore({
          inspectionId: inspection.id,
          type: 'INSPECTION',
        })
      }

      const pdf = await this.storage.getObjectBytes('documents', report.storageKey)
      const delivery = await this.sendWithRetry({
        to: contacts.ownerEmail,
        template: 'inspection-report',
        context: {
          permitNumber: inspection.permit?.permitNumber ?? 'N/A',
          inspectionId: inspection.id,
          recipientName: 'Permit Owner',
        },
        attachments: [
          {
            filename: report.filename,
            content: Buffer.from(pdf),
            type: 'application/pdf',
          },
        ],
      })

      await this.markReportDistributed(report.id)
      await this.logDistributionSuccess({
        entityType: AUDIT_ENTITY.REPORT,
        entityId: report.id,
        inspectionId: inspection.id,
        userId,
        kind,
        messageId: delivery.messageId,
      })

      return {
        kind,
        status: 'sent',
        inspectionId: inspection.id,
        entityId: report.id,
        messageId: delivery.messageId,
      }
    } catch (error) {
      return this.failResult(kind, inspection.id, error, userId, AUDIT_ENTITY.PERMIT_INSPECTION)
    }
  }

  private async distributeDeficiencyNotice(
    inspection: InspectionContext,
    deficiency: Deficiency,
    contacts: StakeholderContacts,
    userId: string,
    force: boolean,
  ): Promise<DistributionResult> {
    const kind: DistributionKind = 'deficiency-notice'
    if (!force && (await this.wasDistributed(AUDIT_ENTITY.DEFICIENCY, deficiency.id, kind))) {
      return {
        kind,
        status: 'skipped',
        inspectionId: inspection.id,
        entityId: deficiency.id,
        reason: 'Already distributed',
      }
    }

    try {
      const delivery = await this.sendWithRetry({
        to: contacts.contractorEmail,
        template: 'deficiency-notice',
        context: {
          permitNumber: inspection.permit?.permitNumber ?? 'N/A',
          deficiencyDescription: deficiency.description,
          dueDate: deficiency.dueDate?.toISOString() ?? 'as soon as possible',
          inspectorName: inspection.schedule?.assignedTo?.name ?? 'Safety Codes Officer',
        },
      })

      await this.logDistributionSuccess({
        entityType: AUDIT_ENTITY.DEFICIENCY,
        entityId: deficiency.id,
        inspectionId: inspection.id,
        userId,
        kind,
        messageId: delivery.messageId,
      })

      return {
        kind,
        status: 'sent',
        inspectionId: inspection.id,
        entityId: deficiency.id,
        messageId: delivery.messageId,
      }
    } catch (error) {
      return this.failResult(
        kind,
        inspection.id,
        error,
        userId,
        AUDIT_ENTITY.DEFICIENCY,
        deficiency.id,
      )
    }
  }

  private async distributeStopWorkOrder(
    inspection: InspectionContext,
    deficiency: Deficiency,
    contacts: StakeholderContacts,
    userId: string,
    force: boolean,
  ): Promise<DistributionResult> {
    const kind: DistributionKind = 'stop-work-order'
    if (!force && (await this.wasDistributed(AUDIT_ENTITY.DEFICIENCY, deficiency.id, kind))) {
      return {
        kind,
        status: 'skipped',
        inspectionId: inspection.id,
        entityId: deficiency.id,
        reason: 'Already distributed',
      }
    }

    const recipients = [
      contacts.ownerEmail,
      contacts.contractorEmail,
      contacts.inspectorEmail,
    ].filter((e): e is string => !!e)

    try {
      const delivery = await this.sendWithRetry({
        to: [...new Set(recipients)],
        template: 'stop-work-order',
        context: {
          permitNumber: inspection.permit?.permitNumber ?? 'N/A',
          deficiencyDescription: deficiency.description,
          issuedAt: new Date().toISOString(),
        },
      })

      await this.logDistributionSuccess({
        entityType: AUDIT_ENTITY.DEFICIENCY,
        entityId: deficiency.id,
        inspectionId: inspection.id,
        userId,
        kind,
        messageId: delivery.messageId,
      })

      return {
        kind,
        status: 'sent',
        inspectionId: inspection.id,
        entityId: deficiency.id,
        messageId: delivery.messageId,
      }
    } catch (error) {
      return this.failResult(
        kind,
        inspection.id,
        error,
        userId,
        AUDIT_ENTITY.DEFICIENCY,
        deficiency.id,
      )
    }
  }

  private async distributeVoCDecision(
    inspection: InspectionContext,
    deficiency: Deficiency,
    voc: VerificationOfCompliance,
    contacts: StakeholderContacts,
    userId: string,
    force: boolean,
  ): Promise<DistributionResult> {
    const kind: DistributionKind = 'voc-decision'
    if (!force && (await this.wasDistributed(AUDIT_ENTITY.VOC, voc.id, kind))) {
      return {
        kind,
        status: 'skipped',
        inspectionId: inspection.id,
        entityId: voc.id,
        reason: 'Already distributed',
      }
    }

    try {
      const delivery = await this.sendWithRetry({
        to: contacts.submitterEmail,
        template: 'voc-decision',
        context: {
          permitNumber: inspection.permit?.permitNumber ?? 'N/A',
          decision: voc.status,
          reviewerName: 'Administrator',
          comments: voc.comments ?? deficiency.vocNotes ?? undefined,
        },
      })

      await this.logDistributionSuccess({
        entityType: AUDIT_ENTITY.VOC,
        entityId: voc.id,
        inspectionId: inspection.id,
        userId,
        kind,
        messageId: delivery.messageId,
      })

      return {
        kind,
        status: 'sent',
        inspectionId: inspection.id,
        entityId: voc.id,
        messageId: delivery.messageId,
      }
    } catch (error) {
      return this.failResult(kind, inspection.id, error, userId, AUDIT_ENTITY.VOC, voc.id)
    }
  }

  private async sendWithRetry(input: {
    to: string | string[]
    template: EmailTemplateId
    context: Record<string, unknown>
    attachments?: { filename: string; content: Buffer; type?: string }[]
  }) {
    let lastError: Error | undefined
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.emailSvc.sendTemplated(input)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < this.maxRetries) {
          await this.sleepFn(this.retryDelayMs)
        }
      }
    }
    throw lastError ?? new Error('Email delivery failed')
  }

  private async wasDistributed(
    entityType: string,
    entityId: string,
    kind: DistributionKind,
  ): Promise<boolean> {
    const logs = await this.audit.listForEntity(entityType, entityId, 100)
    return logs.some(
      (l) =>
        l.action === AUDIT_ACTION.REPORT_DISTRIBUTED &&
        typeof l.metadata === 'object' &&
        l.metadata !== null &&
        !Array.isArray(l.metadata) &&
        (l.metadata as Record<string, unknown>).kind === kind,
    )
  }

  private async logDistributionSuccess(input: {
    entityType: string
    entityId: string
    inspectionId: string
    userId: string
    kind: DistributionKind
    messageId: string
  }) {
    await this.audit.append({
      entityType: input.entityType,
      entityId: input.entityId,
      action: AUDIT_ACTION.REPORT_DISTRIBUTED,
      userId: input.userId,
      metadata: {
        inspectionId: input.inspectionId,
        kind: input.kind,
        messageId: input.messageId,
      },
    })
  }

  private async failResult(
    kind: DistributionKind,
    inspectionId: string,
    error: unknown,
    userId: string,
    entityType: string,
    entityId?: string,
  ): Promise<DistributionResult> {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await this.audit.append({
      entityType,
      entityId: entityId ?? inspectionId,
      action: AUDIT_ACTION.REPORT_DISTRIBUTION_FAILED,
      userId,
      metadata: { inspectionId, kind, error: message },
    })
    return { kind, status: 'failed', inspectionId, entityId, error: message }
  }

  private async markReportDistributed(reportId: string) {
    await prisma.report.update({
      where: { id: reportId },
      data: { distributedAt: new Date() },
    })
  }

  private isInspectionReadyForReport(inspection: InspectionContext): boolean {
    return (
      !!inspection.finalizedAt || inspection.status === 'PASSED' || inspection.status === 'FAILED'
    )
  }

  private async loadInspectionContext(inspectionId: string): Promise<InspectionContext | null> {
    return prisma.permitInspection.findUnique({
      where: { id: inspectionId },
      include: {
        permit: true,
        schedule: { include: { assignedTo: { select: { email: true, name: true } } } },
        deficiencies: { include: { verificationOfCompliance: true } },
        reports: true,
      },
    }) as Promise<InspectionContext | null>
  }

  async resolveContacts(inspection: InspectionContext): Promise<StakeholderContacts> {
    const ownerFromEnv = process.env.DISTRIBUTION_OWNER_EMAIL?.trim()
    const contractorFromEnv = process.env.DISTRIBUTION_CONTRACTOR_EMAIL?.trim()
    const submitterFromEnv = process.env.DISTRIBUTION_VOC_SUBMITTER_EMAIL?.trim()

    const ownerUser = await prisma.user.findFirst({
      where: { role: 'OWNER' },
      select: { email: true },
      orderBy: { createdAt: 'asc' },
    })

    const ownerEmail = ownerFromEnv ?? ownerUser?.email
    if (!ownerEmail) {
      throw new Error('Owner email not configured for distribution')
    }

    return {
      ownerEmail,
      contractorEmail: contractorFromEnv ?? ownerEmail,
      inspectorEmail: inspection.schedule?.assignedTo?.email,
      submitterEmail: submitterFromEnv ?? ownerEmail,
    }
  }
}

export const distributionService = new DistributionService()
