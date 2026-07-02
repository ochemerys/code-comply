import crypto from 'node:crypto'
import { prisma } from '@codecomply/db'
import type { Prisma } from '@codecomply/db'
import type { ComplianceSearchQuery, ComplianceSearchResponse } from '@codecomply/validators'
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  auditLogService,
  type AuditLogService,
} from './audit-log.service.js'
import { ComplianceSearchMapper } from '../mappers/compliance-search.mapper.js'

export type ComplianceSearchFilters = ComplianceSearchQuery

export type ComplianceSearchServiceDeps = {
  auditLog?: AuditLogService
}

export class ComplianceSearchService {
  private readonly audit: AuditLogService

  constructor(deps: ComplianceSearchServiceDeps = {}) {
    this.audit = deps.auditLog ?? auditLogService
  }

  private buildWhere(filters: ComplianceSearchFilters): Prisma.PermitInspectionWhereInput {
    const where: Prisma.PermitInspectionWhereInput = {}
    const permitWhere: Prisma.PermitWhereInput = {}

    if (filters.legalLandDescription?.trim()) {
      permitWhere.legalLandDesc = {
        contains: filters.legalLandDescription.trim(),
        mode: 'insensitive',
      }
    }

    if (filters.permitNumber?.trim()) {
      permitWhere.permitNumber = {
        contains: filters.permitNumber.trim(),
        mode: 'insensitive',
      }
    }

    if (Object.keys(permitWhere).length > 0) {
      where.permit = permitWhere
    }

    if (filters.status) {
      where.status = filters.status
    } else if (filters.outcome) {
      where.status = filters.outcome
    }

    if (filters.dateFrom || filters.dateTo) {
      const scheduledDate: Prisma.DateTimeFilter = {}
      if (filters.dateFrom) {
        scheduledDate.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`)
      }
      if (filters.dateTo) {
        scheduledDate.lte = new Date(`${filters.dateTo}T23:59:59.999Z`)
      }
      where.scheduledDate = scheduledDate
    }

    if (filters.inspectorId?.trim()) {
      const inspectorId = filters.inspectorId.trim()
      where.OR = [{ inspectorId }, { schedule: { assignedToId: inspectorId } }]
    }

    return where
  }

  private readonly include = {
    permit: {
      select: {
        permitNumber: true,
        address: true,
        legalLandDesc: true,
      },
    },
    schedule: {
      include: {
        assignedTo: {
          select: { id: true, name: true },
        },
      },
    },
    inspector: {
      select: { id: true, name: true },
    },
    deficiencies: {
      select: { id: true },
    },
  } as const

  async search(
    filters: ComplianceSearchFilters,
    userId: string,
  ): Promise<ComplianceSearchResponse> {
    const where = this.buildWhere(filters)
    const searchAuditId = crypto.randomUUID()

    const [rows, total] = await Promise.all([
      prisma.permitInspection.findMany({
        where,
        include: this.include,
        orderBy: { scheduledDate: 'desc' },
        take: filters.limit,
        skip: filters.offset,
      }),
      prisma.permitInspection.count({ where }),
    ])

    await this.audit.append({
      entityType: AUDIT_ENTITY.COMPLIANCE_SEARCH,
      entityId: searchAuditId,
      action: AUDIT_ACTION.COMPLIANCE_SEARCH,
      userId,
      metadata: {
        criteria: {
          legalLandDescription: filters.legalLandDescription ?? null,
          dateFrom: filters.dateFrom ?? null,
          dateTo: filters.dateTo ?? null,
          inspectorId: filters.inspectorId ?? null,
          permitNumber: filters.permitNumber ?? null,
          status: filters.status ?? null,
          outcome: filters.outcome ?? null,
        },
        resultCount: total,
        limit: filters.limit,
        offset: filters.offset,
      },
    })

    return {
      results: ComplianceSearchMapper.toResultDTOs(rows as never),
      total,
      searchAuditId,
    }
  }
}

export const complianceSearchService = new ComplianceSearchService()
