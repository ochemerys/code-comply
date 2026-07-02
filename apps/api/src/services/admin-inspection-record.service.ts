import { prisma } from '@codecomply/db'
import type {
  AddendumDTO,
  AddendumSummary,
  AdminInspectionRecordDetail,
  GPSCoordinatesDTO,
} from '@codecomply/validators'
import { GPSCoordinatesDTOSchema } from '@codecomply/validators'
import { IMMUTABLE_INSPECTION_MESSAGE, isInspectionFinalized } from '../middleware/immutable.js'

function parseGps(value: unknown): GPSCoordinatesDTO | undefined {
  const parsed = GPSCoordinatesDTOSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

function mapAddendumSummary(row: {
  id: string
  reason: string
  createdAt: Date
  signature: string | null
  createdBy?: { name: string } | null
}): AddendumSummary {
  return {
    id: row.id,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    createdByName: row.createdBy?.name,
    hasSignature: !!row.signature,
  }
}

export class AdminInspectionRecordService {
  async getRecordDetail(inspectionId: string): Promise<AdminInspectionRecordDetail | null> {
    const row = await prisma.permitInspection.findUnique({
      where: { id: inspectionId },
      include: {
        permit: true,
        inspector: { select: { id: true, name: true } },
        schedule: {
          include: {
            assignedTo: { select: { id: true, name: true } },
          },
        },
        deficiencies: {
          select: {
            id: true,
            description: true,
            status: true,
            severity: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        addendums: {
          include: {
            createdBy: { select: { name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!row) return null

    const finalized = isInspectionFinalized(row)

    return {
      inspectionId: row.id,
      uniqueId: row.uniqueId ?? undefined,
      permitNumber: row.permit?.permitNumber ?? 'N/A',
      legalLandDescription: row.permit?.legalLandDesc ?? undefined,
      address: row.permit?.address ?? 'N/A',
      status: row.status,
      scheduledDate: row.scheduledDate.toISOString(),
      completedDate: row.completedDate?.toISOString(),
      finalizedAt: row.finalizedAt?.toISOString(),
      isFinalized: finalized,
      notes: row.notes ?? undefined,
      documentHash: row.documentHash ?? undefined,
      inspectorName: row.schedule?.assignedTo?.name,
      finalizedByName: row.inspector?.name,
      deficiencyCount: row.deficiencies.length,
      deficiencies: row.deficiencies.map((d) => ({
        id: d.id,
        description: d.description,
        status: d.status,
        severity: d.severity ?? undefined,
      })),
      startGps: parseGps(row.startGps),
      finalizeGps: parseGps(row.finalizeGps),
      hasCertificationSnapshot: row.certificationSnapshot != null,
      addendums: row.addendums.map(mapAddendumSummary),
      appendOnlyMessage: finalized
        ? IMMUTABLE_INSPECTION_MESSAGE
        : 'This inspection is not yet finalized. Records become append-only after finalization.',
    }
  }

  async getAddendum(inspectionId: string, addendumId: string): Promise<AddendumDTO | null> {
    const row = await prisma.addendum.findUnique({
      where: { id: addendumId },
      include: {
        createdBy: { select: { name: true } },
      },
    })

    if (!row || row.inspectionId !== inspectionId) return null

    return {
      id: row.id,
      inspectionId: row.inspectionId,
      reason: row.reason,
      content: row.content,
      createdById: row.createdById,
      createdByName: row.createdBy.name,
      createdAt: row.createdAt.toISOString(),
      signature: row.signature,
    }
  }
}

export const adminInspectionRecordService = new AdminInspectionRecordService()
