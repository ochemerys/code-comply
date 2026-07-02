import { prisma } from '@codecomply/db'
import type { InspectionCertificationSnapshot } from '@codecomply/validators'
import { hashCertificationSnapshot } from '../lib/certification-snapshot-hash.js'

export class InspectionCertificationSnapshotService {
  async getByInspectionId(inspectionId: string): Promise<InspectionCertificationSnapshot | null> {
    const row = await prisma.permitInspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        finalizedAt: true,
        certificationSnapshot: true,
      },
    })

    if (!row) return null

    return {
      inspectionId: row.id,
      finalizedAt: row.finalizedAt?.toISOString(),
      snapshot: row.certificationSnapshot,
      snapshotHash: hashCertificationSnapshot(row.certificationSnapshot),
    }
  }
}

export const inspectionCertificationSnapshotService = new InspectionCertificationSnapshotService()
