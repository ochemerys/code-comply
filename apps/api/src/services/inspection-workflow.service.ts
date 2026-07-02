import { prisma } from '@codecomply/db'
import type { InspectionStage } from '@codecomply/db'
import type {
  AdminInspectionWorkflowDetail,
  AdminNoEntryLetterResponse,
  GPSCoordinatesDTO,
  InspectionWorkflowSyncPayload,
  InspectorUnableToEnterRequest,
  ReportDTO,
  UpdateAdminInspectionWorkflow,
} from '@codecomply/validators'
import { GPSCoordinatesDTOSchema } from '@codecomply/validators'
import { isInspectionFinalized } from '../middleware/immutable.js'
import { reportService } from './report.service.js'
import { distributionService } from './distribution.service.js'

function parseGps(value: unknown): GPSCoordinatesDTO | undefined {
  const parsed = GPSCoordinatesDTOSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

function toIso(d: Date | null | undefined): string | undefined {
  return d ? d.toISOString() : undefined
}

function parseDateInput(value: string | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date')
  return d
}

function mapReport(row: {
  id: string
  inspectionId: string
  type: string
  filename: string
  storageKey: string
  hash: string
  generatedAt: Date
  distributedAt: Date | null
}): ReportDTO {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    type: row.type as ReportDTO['type'],
    filename: row.filename,
    storageKey: row.storageKey,
    hash: row.hash,
    generatedAt: row.generatedAt.toISOString(),
    distributedAt: row.distributedAt?.toISOString() ?? null,
  }
}

export class InspectionWorkflowService {
  async getAdminDetail(inspectionId: string): Promise<AdminInspectionWorkflowDetail | null> {
    const row = await prisma.permitInspection.findUnique({
      where: { id: inspectionId },
      include: {
        permit: true,
        workflow: true,
        reports: {
          where: { type: 'NO_ENTRY' },
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    })
    if (!row) return null

    const wf = row.workflow
    const planned = wf?.plannedDate ?? row.scheduledDate
    const actual = wf?.actualDate ?? row.completedDate ?? undefined

    return {
      inspectionId: row.id,
      permitId: row.permitId ?? undefined,
      permitNumber: row.permit?.permitNumber ?? 'N/A',
      address: row.permit?.address ?? 'N/A',
      status: row.status,
      isFinalized: isInspectionFinalized(row),
      requestedDate: toIso(wf?.requestedDate),
      plannedDate: planned.toISOString(),
      actualDate: actual ? new Date(actual).toISOString() : undefined,
      stages: (wf?.stages ?? []) as AdminInspectionWorkflowDetail['stages'],
      otherStageDescription: wf?.otherStageDescription,
      noFurtherInspectionsRequired: wf?.noFurtherInspectionsRequired ?? false,
      firstNotificationDate: toIso(wf?.firstNotificationDate),
      secondNotificationDate: toIso(wf?.secondNotificationDate),
      unableToEnterComments: wf?.unableToEnterComments,
      geofenceProof: parseGps(wf?.geofenceProof),
      inspectorGpsAtAttempt: parseGps(row.startGps) ?? parseGps(wf?.geofenceProof),
      reInspectionFeeFlagged: wf?.reInspectionFeeFlagged ?? false,
      reInspectionFeeFlaggedAt: toIso(wf?.reInspectionFeeFlaggedAt),
      permitReInspectionFeeFlagged: row.permit?.reInspectionFeeFlagged ?? false,
      ownerNotificationSentAt: toIso(wf?.ownerNotificationSentAt),
      ownerNotificationEmail: wf?.ownerNotificationEmail,
      lastSyncedAt: toIso(wf?.lastSyncedAt),
      latestNoEntryReport: row.reports[0] ? mapReport(row.reports[0]) : undefined,
    }
  }

  async updateAdmin(
    inspectionId: string,
    body: UpdateAdminInspectionWorkflow,
  ): Promise<AdminInspectionWorkflowDetail> {
    const inspection = await prisma.permitInspection.findUnique({
      where: { id: inspectionId },
      include: { permit: true },
    })
    if (!inspection) throw new Error('Inspection not found')
    if (isInspectionFinalized(inspection)) {
      throw new Error('Cannot update workflow on a finalized inspection')
    }

    const requestedDate =
      body.requestedDate !== undefined ? parseDateInput(body.requestedDate) : undefined
    const plannedDate =
      body.plannedDate !== undefined ? parseDateInput(body.plannedDate) : undefined
    const actualDate = body.actualDate !== undefined ? parseDateInput(body.actualDate) : undefined

    const stages = body.stages as InspectionStage[] | undefined

    await prisma.$transaction(async (tx) => {
      const scheduledUpdate =
        plannedDate !== undefined && plannedDate !== null
          ? { scheduledDate: plannedDate }
          : plannedDate === null
            ? { scheduledDate: inspection.scheduledDate }
            : {}

      const completedUpdate = actualDate !== undefined ? { completedDate: actualDate } : {}

      if (Object.keys(scheduledUpdate).length || Object.keys(completedUpdate).length) {
        await tx.permitInspection.update({
          where: { id: inspectionId },
          data: { ...scheduledUpdate, ...completedUpdate },
        })
      }

      await tx.inspectionWorkflow.upsert({
        where: { inspectionId },
        create: {
          inspectionId,
          requestedDate: requestedDate ?? undefined,
          plannedDate: plannedDate ?? inspection.scheduledDate,
          actualDate: actualDate ?? undefined,
          stages: stages ?? [],
          otherStageDescription: body.otherStageDescription ?? undefined,
          noFurtherInspectionsRequired: body.noFurtherInspectionsRequired ?? false,
          firstNotificationDate:
            body.firstNotificationDate !== undefined
              ? (parseDateInput(body.firstNotificationDate) ?? undefined)
              : undefined,
          secondNotificationDate:
            body.secondNotificationDate !== undefined
              ? (parseDateInput(body.secondNotificationDate) ?? undefined)
              : undefined,
          unableToEnterComments: body.unableToEnterComments ?? undefined,
        },
        update: {
          ...(requestedDate !== undefined ? { requestedDate } : {}),
          ...(plannedDate !== undefined ? { plannedDate } : {}),
          ...(actualDate !== undefined ? { actualDate } : {}),
          ...(stages !== undefined ? { stages } : {}),
          ...(body.otherStageDescription !== undefined
            ? { otherStageDescription: body.otherStageDescription }
            : {}),
          ...(body.noFurtherInspectionsRequired !== undefined
            ? { noFurtherInspectionsRequired: body.noFurtherInspectionsRequired }
            : {}),
          ...(body.firstNotificationDate !== undefined
            ? { firstNotificationDate: parseDateInput(body.firstNotificationDate) }
            : {}),
          ...(body.secondNotificationDate !== undefined
            ? { secondNotificationDate: parseDateInput(body.secondNotificationDate) }
            : {}),
          ...(body.unableToEnterComments !== undefined
            ? { unableToEnterComments: body.unableToEnterComments }
            : {}),
        },
      })

      if (body.firstNotificationDate) {
        await this.applyReInspectionFeeFlag(tx, inspectionId, inspection.permitId)
      }
    })

    const detail = await this.getAdminDetail(inspectionId)
    if (!detail) throw new Error('Inspection not found')
    return detail
  }

  async upsertFromSync(payload: InspectionWorkflowSyncPayload, userId: string): Promise<void> {
    const inspection = await prisma.permitInspection.findUnique({
      where: { id: payload.inspectionId },
      include: { schedule: true },
    })
    if (!inspection) throw new Error('Inspection not found')
    if (inspection.schedule?.assignedToId !== userId) {
      throw new Error('User not assigned to this inspection')
    }

    const unable = payload.unableToEnter
    const firstNotification = unable?.firstNotificationDate
      ? new Date(unable.firstNotificationDate)
      : undefined

    await prisma.$transaction(async (tx) => {
      if (payload.plannedDate) {
        await tx.permitInspection.update({
          where: { id: payload.inspectionId },
          data: { scheduledDate: new Date(payload.plannedDate) },
        })
      }
      if (payload.actualDate) {
        await tx.permitInspection.update({
          where: { id: payload.inspectionId },
          data: { completedDate: new Date(payload.actualDate) },
        })
      }

      await tx.inspectionWorkflow.upsert({
        where: { inspectionId: payload.inspectionId },
        create: {
          inspectionId: payload.inspectionId,
          requestedDate: payload.requestedDate ? new Date(payload.requestedDate) : undefined,
          plannedDate: payload.plannedDate
            ? new Date(payload.plannedDate)
            : inspection.scheduledDate,
          actualDate: payload.actualDate ? new Date(payload.actualDate) : undefined,
          stages: (payload.stages ?? []) as InspectionStage[],
          otherStageDescription: payload.otherStageDescription,
          noFurtherInspectionsRequired: payload.noFurtherInspectionsRequired ?? false,
          firstNotificationDate: firstNotification,
          secondNotificationDate: unable?.secondNotificationDate
            ? new Date(unable.secondNotificationDate)
            : undefined,
          unableToEnterComments: unable?.comments,
          geofenceProof: unable?.geofenceProof ?? undefined,
          lastSyncedAt: new Date(),
        },
        update: {
          ...(payload.requestedDate ? { requestedDate: new Date(payload.requestedDate) } : {}),
          ...(payload.plannedDate ? { plannedDate: new Date(payload.plannedDate) } : {}),
          ...(payload.actualDate ? { actualDate: new Date(payload.actualDate) } : {}),
          ...(payload.stages ? { stages: payload.stages as InspectionStage[] } : {}),
          ...(payload.otherStageDescription !== undefined
            ? { otherStageDescription: payload.otherStageDescription }
            : {}),
          ...(payload.noFurtherInspectionsRequired !== undefined
            ? { noFurtherInspectionsRequired: payload.noFurtherInspectionsRequired }
            : {}),
          ...(firstNotification ? { firstNotificationDate: firstNotification } : {}),
          ...(unable?.secondNotificationDate
            ? { secondNotificationDate: new Date(unable.secondNotificationDate) }
            : {}),
          ...(unable?.comments !== undefined ? { unableToEnterComments: unable.comments } : {}),
          ...(unable?.geofenceProof ? { geofenceProof: unable.geofenceProof } : {}),
          lastSyncedAt: new Date(),
        },
      })

      if (firstNotification) {
        await this.applyReInspectionFeeFlag(tx, payload.inspectionId, inspection.permitId)
      }
    })
  }

  /** LSC-A-03 — field unable-to-enter attempt with GPS proof (no checklist finalization). */
  async recordUnableToEnterFromField(
    inspectionId: string,
    userId: string,
    body: InspectorUnableToEnterRequest,
  ): Promise<{ inspectionId: string; syncedAt: string }> {
    await this.upsertFromSync(
      {
        inspectionId,
        unableToEnter: {
          firstNotificationDate: body.attemptAt,
          comments: body.comments,
          geofenceProof: body.geofenceProof,
        },
      },
      userId,
    )

    await prisma.permitInspection.update({
      where: { id: inspectionId },
      data: {
        startGps: body.geofenceProof as object,
        lastSyncedAt: new Date(),
      },
    })

    const syncedAt = new Date().toISOString()
    return { inspectionId, syncedAt }
  }

  private async applyReInspectionFeeFlag(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    inspectionId: string,
    permitId: string | null,
  ): Promise<void> {
    const now = new Date()
    const existing = await tx.inspectionWorkflow.findUnique({ where: { inspectionId } })
    if (existing) {
      await tx.inspectionWorkflow.update({
        where: { inspectionId },
        data: { reInspectionFeeFlagged: true, reInspectionFeeFlaggedAt: now },
      })
    } else {
      await tx.inspectionWorkflow.create({
        data: {
          inspectionId,
          reInspectionFeeFlagged: true,
          reInspectionFeeFlaggedAt: now,
        },
      })
    }
    if (permitId) {
      await tx.permit.update({
        where: { id: permitId },
        data: { reInspectionFeeFlagged: true },
      })
    }
  }

  async generateAndDistributeNoEntryLetter(
    inspectionId: string,
    userId: string,
    ownerEmail?: string,
  ): Promise<AdminNoEntryLetterResponse> {
    const wf = await prisma.inspectionWorkflow.findUnique({ where: { inspectionId } })
    if (!wf?.firstNotificationDate) {
      throw new Error('Date of 1st Notification is required before generating a No Entry letter')
    }

    const reportRow = await reportService.generateAndStore({
      inspectionId,
      type: 'NO_ENTRY',
    })

    let ownerNotificationSentAt: string | undefined
    let notifiedEmail: string | undefined

    if (ownerEmail) {
      const dist = await distributionService.distributeReportByEmail({
        reportId: reportRow.id,
        recipientKeys: ['custom'],
        customEmails: [ownerEmail],
        userId,
      })
      if (dist.status === 'sent') {
        ownerNotificationSentAt = new Date().toISOString()
        notifiedEmail = ownerEmail
        await prisma.inspectionWorkflow.update({
          where: { inspectionId },
          data: {
            ownerNotificationSentAt: new Date(),
            ownerNotificationEmail: ownerEmail,
          },
        })
      }
    }

    return {
      report: mapReport(reportRow),
      ownerNotificationSentAt,
      ownerNotificationEmail: notifiedEmail,
    }
  }
}

export const inspectionWorkflowService = new InspectionWorkflowService()
