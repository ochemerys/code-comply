import { prisma } from '@codecomply/db'
import type { PermitStatus } from '@codecomply/db'
import type { PermitSyncResultDTO, PermitSyncStatusDTO } from '@codecomply/validators'
import { AUDIT_ACTION, AUDIT_ENTITY, auditLogService } from './audit-log.service.js'

type MunicipalPermitRow = {
  permitNumber: string
  address: string
  legalLandDesc?: string | null
  scope: string
  status: PermitStatus
  latitude?: number | null
  longitude?: number | null
}

/**
 * Municipal permit import (A-02). Reads the authoritative municipal feed table
 * (simulating an external permitting system) and upserts into the agency catalog.
 */
export class PermitSyncService {
  async getStatus(): Promise<PermitSyncStatusDTO> {
    const last = await prisma.auditLog.findFirst({
      where: { entityType: AUDIT_ENTITY.PERMIT, action: AUDIT_ACTION.PERMIT_SYNC },
      orderBy: { timestamp: 'desc' },
    })

    if (!last) {
      return { lastSyncedAt: null, status: 'idle' }
    }

    const metadata = (last.metadata ?? {}) as { status?: string; lastError?: string }
    const status =
      metadata.status === 'error' ? 'error' : metadata.status === 'syncing' ? 'syncing' : 'success'

    return {
      lastSyncedAt: last.timestamp.toISOString(),
      status,
      lastError: metadata.lastError,
    }
  }

  async syncFromMunicipal(userId: string): Promise<PermitSyncResultDTO> {
    const syncedAt = new Date()
    const municipal = await this.fetchMunicipalCatalog()

    let newPermits = 0
    let updatedPermits = 0
    let unchanged = 0

    for (const row of municipal) {
      const existing = await prisma.permit.findUnique({
        where: { permitNumber: row.permitNumber },
      })

      if (!existing) {
        await prisma.permit.create({ data: row })
        newPermits++
        continue
      }

      const needsUpdate =
        existing.address !== row.address ||
        existing.scope !== row.scope ||
        existing.status !== row.status ||
        existing.legalLandDesc !== (row.legalLandDesc ?? null) ||
        existing.latitude !== (row.latitude ?? null) ||
        existing.longitude !== (row.longitude ?? null)

      if (needsUpdate) {
        await prisma.permit.update({
          where: { id: existing.id },
          data: {
            address: row.address,
            scope: row.scope,
            status: row.status,
            legalLandDesc: row.legalLandDesc ?? null,
            latitude: row.latitude ?? null,
            longitude: row.longitude ?? null,
          },
        })
        updatedPermits++
      } else {
        unchanged++
      }
    }

    const result: PermitSyncResultDTO = {
      syncedAt: syncedAt.toISOString(),
      newPermits,
      updatedPermits,
      unchanged,
    }

    await auditLogService.append({
      entityType: AUDIT_ENTITY.PERMIT,
      entityId: 'municipal',
      action: AUDIT_ACTION.PERMIT_SYNC,
      userId,
      metadata: {
        status: 'success',
        newPermits: result.newPermits,
        updatedPermits: result.updatedPermits,
        unchanged: result.unchanged,
        syncedAt: result.syncedAt,
      },
    })

    return result
  }

  private async fetchMunicipalCatalog(): Promise<MunicipalPermitRow[]> {
    const feed = await prisma.municipalPermitFeedEntry.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { permitNumber: 'asc' },
    })

    return feed.map((p) => ({
      permitNumber: p.permitNumber,
      address: p.address,
      legalLandDesc: p.legalLandDesc,
      scope: p.scope,
      status: p.status,
      latitude: p.latitude,
      longitude: p.longitude,
    }))
  }
}

export const permitSyncService = new PermitSyncService()
