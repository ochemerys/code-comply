import { createHash } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import { prisma } from '@codecomply/db'
import type { Deficiency, PermitInspection, Permit, Photo, Report } from '@codecomply/db'
import type { GenerateReportDTO, ReportTypeDTO } from '@codecomply/validators'
import {
  DEFAULT_INSPECTION_PDF_LAYOUT,
  type PdfKitDocument,
  renderPdfBuffer,
} from '../lib/pdf/pdf-generator.js'
import { renderDeficiencyReportTemplate } from '../lib/pdf/templates/deficiency-report.js'
import {
  embedPhotoEvidencePages,
  renderInspectionReportIntegrityPage,
  renderInspectionReportMainSections,
  type InspectionReportTemplateContext,
} from '../lib/pdf/templates/inspection-report.js'
import {
  renderNoEntryLetterTemplate,
  type NoEntryLetterTemplateContext,
} from '../lib/pdf/templates/no-entry-letter.js'
import {
  renderStopWorkOrderTemplate,
  type StopWorkOrderTemplateContext,
} from '../lib/pdf/templates/stop-work-order.js'
import { buildReportVerifyUrl, formatUniqueReportId } from '../lib/report-verify.js'
import type { ObjectStorageClient } from '../lib/storage/storage-client.js'
import { createObjectStorageClientFromEnv } from '../lib/storage/storage-client.js'
import {
  PDF_GENERATION_TIMEOUT_MS,
  PDF_MAX_PHOTOS_PER_REPORT,
} from '../lib/pdf/pdf-generation-config.js'
import {
  runPdfGenerationWithTimeout,
  type PdfGenerationRunOptions,
} from '../lib/pdf/pdf-generation-runner.js'
import {
  emitPdfProgress,
  type PdfGenerationProgressCallback,
} from '../lib/pdf/pdf-generation-progress.js'
import { preparePhotoBuffersForPdf, type PhotoFetchInput } from '../lib/pdf/pdf-image-prep.js'

export type ReportStorage = Pick<
  ObjectStorageClient,
  'getObjectBytes' | 'putObject' | 'getSignedGetUrl'
>

export const REPORT_SIGNED_URL_TTL_SECONDS = 3600

export type {
  PdfGenerationProgress,
  PdfGenerationProgressCallback,
} from '../lib/pdf/pdf-generation-progress.js'
export type { PdfGenerationRunOptions } from '../lib/pdf/pdf-generation-runner.js'
export { PdfGenerationTimeoutError } from '../lib/pdf/pdf-generation-runner.js'

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

/** Canonical SHA-256 hash for legal/report payloads (hex). */
export function computeReportDocumentHash(payload: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex')
}

async function qrPngBuffer(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, { type: 'png', width: 160, margin: 1, errorCorrectionLevel: 'M' })
}

function qrForReport(reportId: string, hash: string): Promise<Buffer> {
  return qrPngBuffer(buildReportVerifyUrl(reportId, hash))
}

type InspectionReportRow = PermitInspection & {
  permit: Permit | null
  inspector: { name: string; designationId: string | null } | null
  schedule: {
    assignedTo: {
      name: string
      email: string
      designationId: string | null
    } | null
  } | null
  deficiencies: (Deficiency & {
    photos: Photo[]
    createdBy: { name: string }
  })[]
  photos: Photo[]
  checklistExecutions: Array<{
    id: string
    progress: number
    completedAt: Date | null
    template: { name: string; discipline: string }
  }>
}

type DeficiencyReportRow = Deficiency & {
  photos: Photo[]
  createdBy: { name: string }
  inspection: PermitInspection & {
    permit: Permit | null
    inspector: { name: string; designationId: string | null } | null
    schedule: {
      assignedTo: {
        name: string
        email: string
        designationId: string | null
      } | null
    } | null
  }
}

/**
 * PDF reports for inspections, deficiencies, and no-entry notices — includes photos, hash, and QR verification.
 */
export class ReportService {
  constructor(private readonly injectedStorage?: ReportStorage) {}

  private get storage(): ReportStorage {
    return this.injectedStorage ?? getDefaultReportStorage()
  }

  async generateInspectionReport(
    inspectionId: string,
    options?: PdfGenerationRunOptions,
  ): Promise<Buffer> {
    return runPdfGenerationWithTimeout(
      (onProgress) => this.generateInspectionReportInternal(inspectionId, onProgress),
      options,
    )
  }

  /** Async entry point with progress tracking (M11-S12). */
  generateInspectionReportAsync(
    inspectionId: string,
    options?: PdfGenerationRunOptions,
  ): Promise<Buffer> {
    return this.generateInspectionReport(inspectionId, options)
  }

  private async generateInspectionReportInternal(
    inspectionId: string,
    onProgress?: PdfGenerationProgressCallback,
  ): Promise<Buffer> {
    emitPdfProgress(onProgress, {
      phase: 'loading-data',
      completed: 0,
      total: 1,
      message: 'Loading inspection',
    })

    const inspection = await this.loadInspection(inspectionId)
    const hash = computeReportDocumentHash(this.buildInspectionHashPayload(inspection))
    const qr = await qrPngBuffer(`verify:inspection:${inspection.id}:${hash}`)

    const inspectionPhotoBuffers = await this.resolvePhotoBuffers(inspection.photos, onProgress)
    const deficiencyPhotoBuffers = await this.resolveDeficiencyPhotoBuffers(
      inspection.deficiencies,
      onProgress,
    )

    const ctx = this.buildInspectionTemplateContext(inspection, hash, qr)

    emitPdfProgress(onProgress, {
      phase: 'rendering-pdf',
      completed: 0,
      total: 1,
      message: 'Rendering PDF',
    })

    return renderPdfBuffer((doc: PdfKitDocument) => {
      doc.font(DEFAULT_INSPECTION_PDF_LAYOUT.bodyFont)
      renderInspectionReportMainSections(doc, ctx)
      embedPhotoEvidencePages(doc, 'Inspection photos', inspectionPhotoBuffers)

      for (const d of inspection.deficiencies) {
        const shots = deficiencyPhotoBuffers.get(d.id) ?? []
        if (shots.length > 0) {
          embedPhotoEvidencePages(doc, `Deficiency evidence (${d.id.slice(0, 8)}…)`, shots)
        }
      }

      renderInspectionReportIntegrityPage(doc, ctx)
    })
  }

  async generateDeficiencyReport(deficiencyId: string): Promise<Buffer> {
    const deficiency = await prisma.deficiency.findUnique({
      where: { id: deficiencyId },
      include: {
        photos: { orderBy: { createdAt: 'asc' } },
        createdBy: { select: { name: true } },
        inspection: {
          include: {
            permit: true,
            inspector: { select: { name: true, designationId: true } },
            schedule: {
              include: {
                assignedTo: { select: { name: true, email: true, designationId: true } },
              },
            },
          },
        },
      },
    })
    if (!deficiency) {
      throw new Error('Deficiency not found')
    }

    const inspection = deficiency.inspection
    const payload = this.buildDeficiencyHashPayload(deficiency, inspection)
    const hash = computeReportDocumentHash(payload)
    const qr = await qrPngBuffer(`verify:deficiency:${deficiency.id}:${hash}`)
    const shots = await this.resolvePhotoBuffers(deficiency.photos, undefined)

    const permitLine =
      inspection.permit != null
        ? `${inspection.permit.permitNumber} — ${inspection.permit.address}`
        : null

    return renderPdfBuffer((doc: PdfKitDocument) => {
      doc.font(DEFAULT_INSPECTION_PDF_LAYOUT.bodyFont)
      renderDeficiencyReportTemplate(doc, {
        deficiencyId: deficiency.id,
        recordedBy: deficiency.createdBy.name,
        severity: deficiency.severity,
        status: deficiency.status,
        description: deficiency.description,
        location: deficiency.location,
        permitLine,
        documentHash: hash,
        qrPng: qr,
        evidencePhotoBuffers: shots,
      })
    })
  }

  async generateStopWorkOrder(deficiencyId: string, reportId?: string): Promise<Buffer> {
    const deficiency = await prisma.deficiency.findUnique({
      where: { id: deficiencyId },
      include: {
        photos: { orderBy: { createdAt: 'asc' } },
        inspection: {
          include: {
            permit: true,
            inspector: { select: { name: true, designationId: true } },
            schedule: {
              include: {
                assignedTo: { select: { name: true, email: true, designationId: true } },
              },
            },
          },
        },
      },
    })
    if (!deficiency) {
      throw new Error('Deficiency not found')
    }
    if (!deficiency.isStopWork && !deficiency.isUnsafe) {
      throw new Error('Deficiency is not marked as stop work or unsafe condition')
    }

    const inspection = deficiency.inspection
    const payload = this.buildStopWorkHashPayload(deficiency as DeficiencyReportRow, inspection)
    const hash = computeReportDocumentHash(payload)
    const qr = reportId
      ? await qrForReport(reportId, hash)
      : await qrPngBuffer(`verify:stop-work:${deficiency.id}:${hash}`)
    const shots = await this.resolvePhotoBuffers(deficiency.photos, undefined)

    const inspectorName = inspection.inspector?.name ?? inspection.schedule?.assignedTo?.name ?? '—'
    const designation =
      inspection.inspector?.designationId ?? inspection.schedule?.assignedTo?.designationId ?? null
    const permitLine =
      inspection.permit != null
        ? `${inspection.permit.permitNumber} — ${inspection.permit.address}`
        : null

    const ctx: StopWorkOrderTemplateContext = {
      orderRecordId: deficiency.id,
      inspectorName,
      designation,
      permitLine,
      issuedAtIso: new Date().toISOString(),
      deficiencyDescription: deficiency.description,
      location: deficiency.location,
      documentHash: hash,
      qrPng: qr,
      evidencePhotoBuffers: shots,
    }

    return renderPdfBuffer((doc: PdfKitDocument) => {
      doc.font(DEFAULT_INSPECTION_PDF_LAYOUT.bodyFont)
      renderStopWorkOrderTemplate(doc, ctx)
    })
  }

  async generateNoEntryLetter(inspectionId: string): Promise<Buffer> {
    const inspection = await this.loadInspection(inspectionId)
    const payload = this.buildNoEntryHashPayload(inspection)
    const hash = computeReportDocumentHash(payload)
    const qr = await qrPngBuffer(`verify:no-entry:${inspection.id}:${hash}`)

    const ctx = this.buildNoEntryTemplateContext(inspection, hash, qr)

    return renderPdfBuffer((doc: PdfKitDocument) => {
      doc.font(DEFAULT_INSPECTION_PDF_LAYOUT.bodyFont)
      renderNoEntryLetterTemplate(doc, ctx)
    })
  }

  private buildInspectionTemplateContext(
    inspection: InspectionReportRow,
    hash: string,
    qr: Buffer,
  ): InspectionReportTemplateContext {
    const inspectorName = inspection.inspector?.name ?? inspection.schedule?.assignedTo?.name ?? '—'
    const designation =
      inspection.inspector?.designationId ?? inspection.schedule?.assignedTo?.designationId ?? null

    const checklistSummaryLines = inspection.checklistExecutions.map((ex) => {
      const pct = (ex.progress * 100).toFixed(0)
      const done = ex.completedAt ? `completed ${ex.completedAt.toISOString()}` : 'in progress'
      return `• ${ex.template.name} (${ex.template.discipline}) — ${pct}% — ${done}`
    })

    let certificationSummary: string | null = null
    if (inspection.certificationSnapshot != null) {
      try {
        const s = JSON.stringify(inspection.certificationSnapshot)
        certificationSummary = s.length > 1200 ? `${s.slice(0, 1200)}…` : s
      } catch {
        certificationSummary = '[certification snapshot present — non-serializable]'
      }
    }

    let outcomeLabel: string | null = null
    if (inspection.status === 'PASSED') outcomeLabel = 'Passed'
    else if (inspection.status === 'FAILED') outcomeLabel = 'Failed'

    return {
      inspectorName,
      designation,
      permit: inspection.permit
        ? {
            permitNumber: inspection.permit.permitNumber,
            address: inspection.permit.address,
            scope: inspection.permit.scope,
          }
        : null,
      inspection: {
        reportId: inspection.uniqueId ?? inspection.id,
        scheduledIso: inspection.scheduledDate.toISOString(),
        completedIso: inspection.completedDate?.toISOString() ?? null,
        status: inspection.status,
        notes: inspection.notes,
        outcomeLabel,
        certificationSummary,
      },
      checklistSummaryLines,
      deficiencies: inspection.deficiencies.map((d) => ({
        severity: d.severity,
        status: d.status,
        description: d.description,
        location: d.location,
      })),
      documentHash: hash,
      qrPng: qr,
    }
  }

  private buildNoEntryTemplateContext(
    inspection: InspectionReportRow,
    hash: string,
    qr: Buffer,
  ): NoEntryLetterTemplateContext {
    const inspectorName = inspection.inspector?.name ?? inspection.schedule?.assignedTo?.name ?? '—'
    const scoId =
      inspection.inspector?.designationId ?? inspection.schedule?.assignedTo?.designationId ?? null

    let arrivalTimeDisplay: string | null = null
    if (inspection.startGps && typeof inspection.startGps === 'object') {
      const g = inspection.startGps as Record<string, unknown>
      if (typeof g.timestamp === 'string') arrivalTimeDisplay = g.timestamp
    }

    const reasonLines =
      inspection.notes && inspection.notes.trim().length > 0
        ? inspection.notes.split(/\r?\n/).filter((l) => l.trim().length > 0)
        : ['Reason recorded in agency workflow — see inspection notes field in system of record.']

    return {
      permitNumber: inspection.permit?.permitNumber ?? null,
      siteAddress: inspection.permit?.address ?? null,
      attemptDateIso: inspection.scheduledDate.toISOString(),
      arrivalTimeDisplay,
      inspectorName,
      scoId,
      reasonLines,
      notificationOrdinal: 1,
      priorNotificationSummary: null,
      letterRecordId: inspection.uniqueId ?? inspection.id,
      documentHash: hash,
      qrPng: qr,
    }
  }

  private async loadInspection(inspectionId: string): Promise<InspectionReportRow> {
    const inspection = await prisma.permitInspection.findUnique({
      where: { id: inspectionId },
      include: {
        permit: true,
        inspector: { select: { name: true, designationId: true } },
        schedule: {
          include: {
            assignedTo: {
              select: { name: true, email: true, designationId: true },
            },
          },
        },
        deficiencies: {
          orderBy: { createdAt: 'asc' },
          include: {
            photos: { orderBy: { createdAt: 'asc' } },
            createdBy: { select: { name: true } },
          },
        },
        photos: { orderBy: { createdAt: 'asc' } },
        checklistExecutions: {
          orderBy: { updatedAt: 'desc' },
          include: {
            template: { select: { name: true, discipline: true } },
          },
        },
      },
    })
    if (!inspection) {
      throw new Error('Inspection not found')
    }
    return inspection as InspectionReportRow
  }

  private buildInspectionHashPayload(inspection: InspectionReportRow): Record<string, unknown> {
    return {
      type: 'inspection-report',
      inspectionId: inspection.id,
      uniqueId: inspection.uniqueId ?? null,
      permitId: inspection.permitId,
      scheduledDate: inspection.scheduledDate.toISOString(),
      status: inspection.status,
      deficiencyIds: inspection.deficiencies.map((d) => d.id).sort(),
      photoIds: inspection.photos.map((p) => p.id).sort(),
    }
  }

  private buildDeficiencyHashPayload(
    deficiency: DeficiencyReportRow,
    inspection: PermitInspection,
  ): Record<string, unknown> {
    return {
      type: 'deficiency-report',
      deficiencyId: deficiency.id,
      inspectionId: inspection.id,
      severity: deficiency.severity,
      status: deficiency.status,
      photoIds: (deficiency.photos ?? []).map((p) => p.id).sort(),
    }
  }

  private buildNoEntryHashPayload(inspection: InspectionReportRow): Record<string, unknown> {
    return {
      type: 'no-entry-letter',
      inspectionId: inspection.id,
      uniqueId: inspection.uniqueId ?? null,
      permitId: inspection.permitId,
      scheduledDate: inspection.scheduledDate.toISOString(),
    }
  }

  private buildStopWorkHashPayload(
    deficiency: DeficiencyReportRow,
    inspection: PermitInspection,
  ): Record<string, unknown> {
    return {
      type: 'stop-work-order',
      deficiencyId: deficiency.id,
      inspectionId: inspection.id,
      isStopWork: deficiency.isStopWork,
      isUnsafe: deficiency.isUnsafe,
      photoIds: (deficiency.photos ?? []).map((p) => p.id).sort(),
    }
  }

  private capPhotosForPdf(photos: Photo[]): Photo[] {
    if (photos.length <= PDF_MAX_PHOTOS_PER_REPORT) return photos
    return photos.slice(0, PDF_MAX_PHOTOS_PER_REPORT)
  }

  private toPhotoFetchInputs(photos: Photo[]): PhotoFetchInput[] {
    return this.capPhotosForPdf(photos).map((p) => ({
      id: p.id,
      storageKey: p.storageKey,
    }))
  }

  private async resolvePhotoBuffers(
    photos: Photo[],
    onProgress?: PdfGenerationProgressCallback,
  ): Promise<Buffer[]> {
    return preparePhotoBuffersForPdf(
      this.toPhotoFetchInputs(photos),
      async (photo) => {
        if (!photo.storageKey) return null
        const bytes = await this.storage.getObjectBytes('photos', photo.storageKey)
        return Buffer.from(bytes)
      },
      onProgress,
    )
  }

  private async resolveDeficiencyPhotoBuffers(
    deficiencies: InspectionReportRow['deficiencies'],
    onProgress?: PdfGenerationProgressCallback,
  ): Promise<Map<string, Buffer[]>> {
    const map = new Map<string, Buffer[]>()
    for (const d of deficiencies) {
      map.set(d.id, await this.resolvePhotoBuffers(d.photos, onProgress))
    }
    return map
  }

  async generateAndStore(input: GenerateReportDTO): Promise<Report> {
    const reportId = randomUUID()
    const { buffer, hash, filename, type } = await this.buildPdfArtifact(input, reportId)
    const storageKey = `reports/${input.inspectionId}/${randomUUID()}-${filename}`

    await this.storage.putObject('documents', storageKey, buffer, 'application/pdf')

    return prisma.report.create({
      data: {
        id: reportId,
        inspectionId: input.inspectionId,
        type,
        filename,
        storageKey,
        hash,
      },
    })
  }

  async verifyReport(reportId: string, hash: string) {
    const row = await prisma.report.findUnique({
      where: { id: reportId },
      include: { inspection: { select: { uniqueId: true } } },
    })
    if (!row) {
      return {
        valid: false,
        reportId,
        uniqueReportId: reportId,
        type: 'UNKNOWN',
        hash,
        generatedAt: new Date(0).toISOString(),
        message: 'Report not found',
      }
    }
    const valid = row.hash === hash
    return {
      valid,
      reportId: row.id,
      uniqueReportId: formatUniqueReportId(row.inspection.uniqueId, row.id),
      type: row.type,
      hash: row.hash,
      generatedAt: row.generatedAt.toISOString(),
      message: valid
        ? 'Document integrity verified — hash matches the stored record.'
        : 'Hash does not match the stored record.',
    }
  }

  async listForInspection(inspectionId: string): Promise<Report[]> {
    return prisma.report.findMany({
      where: { inspectionId },
      orderBy: { generatedAt: 'desc' },
    })
  }

  async getById(reportId: string): Promise<Report | null> {
    return prisma.report.findUnique({ where: { id: reportId } })
  }

  async getSignedDownloadUrl(reportId: string): Promise<string> {
    const row = await prisma.report.findUnique({ where: { id: reportId } })
    if (!row) {
      throw new Error('Report not found')
    }
    return this.storage.getSignedGetUrl('documents', row.storageKey, REPORT_SIGNED_URL_TTL_SECONDS)
  }

  private async buildPdfArtifact(
    input: GenerateReportDTO,
    reportId: string,
  ): Promise<{
    buffer: Buffer
    hash: string
    filename: string
    type: ReportTypeDTO
  }> {
    switch (input.type) {
      case 'INSPECTION': {
        const inspection = await this.loadInspection(input.inspectionId)
        const hash = computeReportDocumentHash(this.buildInspectionHashPayload(inspection))
        const buffer = await this.generateInspectionReport(input.inspectionId, {
          timeoutMs: PDF_GENERATION_TIMEOUT_MS,
        })
        return { buffer, hash, filename: 'inspection-report.pdf', type: 'INSPECTION' }
      }
      case 'NO_ENTRY': {
        const inspection = await this.loadInspection(input.inspectionId)
        const hash = computeReportDocumentHash(this.buildNoEntryHashPayload(inspection))
        const buffer = await this.generateNoEntryLetter(input.inspectionId)
        return { buffer, hash, filename: 'no-entry-letter.pdf', type: 'NO_ENTRY' }
      }
      case 'DEFICIENCY': {
        const deficiencyId = input.deficiencyId!
        const deficiency = await prisma.deficiency.findUnique({
          where: { id: deficiencyId },
          include: {
            inspection: true,
            photos: { orderBy: { createdAt: 'asc' } },
          },
        })
        if (!deficiency || deficiency.inspectionId !== input.inspectionId) {
          throw new Error('Deficiency not found for inspection')
        }
        const hash = computeReportDocumentHash(
          this.buildDeficiencyHashPayload(deficiency as DeficiencyReportRow, deficiency.inspection),
        )
        const buffer = await this.generateDeficiencyReport(deficiencyId)
        return { buffer, hash, filename: `deficiency-${deficiencyId}.pdf`, type: 'DEFICIENCY' }
      }
      case 'STOP_WORK': {
        const deficiencyId = input.deficiencyId!
        const deficiency = await prisma.deficiency.findUnique({
          where: { id: deficiencyId },
          include: {
            inspection: true,
            photos: { orderBy: { createdAt: 'asc' } },
          },
        })
        if (!deficiency || deficiency.inspectionId !== input.inspectionId) {
          throw new Error('Deficiency not found for inspection')
        }
        if (!deficiency.isStopWork && !deficiency.isUnsafe) {
          throw new Error('Deficiency is not marked as stop work or unsafe condition')
        }
        const hash = computeReportDocumentHash(
          this.buildStopWorkHashPayload(deficiency as DeficiencyReportRow, deficiency.inspection),
        )
        const buffer = await this.generateStopWorkOrder(deficiencyId, reportId)
        return { buffer, hash, filename: `stop-work-${deficiencyId}.pdf`, type: 'STOP_WORK' }
      }
      default:
        throw new Error(`Unsupported report type: ${input.type as string}`)
    }
  }
}

let defaultReportStorage: ReportStorage | undefined

function getDefaultReportStorage(): ReportStorage {
  if (!defaultReportStorage) {
    defaultReportStorage = createObjectStorageClientFromEnv()
  }
  return defaultReportStorage
}

/** @internal Resets lazy storage so tests can change env between cases (M10-S15-B1). */
export function resetReportServiceStorageForTests(): void {
  defaultReportStorage = undefined
}

export const reportService = new ReportService()
