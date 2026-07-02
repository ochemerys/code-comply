import { prisma } from '@codecomply/db'
import type { AdminDashboardPayloadDTO } from '@codecomply/validators'
import { orderEscalationService } from './order-escalation.service.js'

function startOfUtcDay(d = new Date()): Date {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

function mapMonitorStatus(
  status: string,
): 'IN_PROGRESS' | 'REVIEW' | 'PENDING_SUBMISSION' | 'SUBMITTED' | 'COMPLETED' {
  switch (status) {
    case 'SCHEDULED':
      return 'PENDING_SUBMISSION'
    case 'IN_PROGRESS':
      return 'IN_PROGRESS'
    case 'PASSED':
    case 'FAILED':
      return 'COMPLETED'
    default:
      return 'REVIEW'
  }
}

export class AdminDashboardService {
  async getPayload(): Promise<AdminDashboardPayloadDTO> {
    const todayStart = startOfUtcDay()
    const tomorrowStart = new Date(todayStart)
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1)

    const [
      activeInspectors,
      pendingInspections,
      completedToday,
      recentInspections,
      unassignedSchedules,
      ordersSummary,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'SCO', isActive: true } }),
      prisma.permitInspection.count({
        where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
      }),
      prisma.permitInspection.count({
        where: {
          status: { in: ['PASSED', 'FAILED'] },
          completedDate: { gte: todayStart, lt: tomorrowStart },
        },
      }),
      prisma.permitInspection.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        include: {
          permit: { select: { permitNumber: true } },
          schedule: { include: { assignedTo: { select: { name: true } } } },
        },
      }),
      prisma.inspectionSchedule.findMany({
        where: { assignedTo: { isActive: true } },
        take: 5,
        orderBy: { assignedDate: 'asc' },
        include: {
          inspection: { include: { permit: { select: { permitNumber: true } } } },
          assignedTo: { select: { name: true } },
        },
      }),
      orderEscalationService.getSummary(),
    ])

    return {
      stats: {
        activeInspectors,
        pendingInspections,
        completedToday,
        stopWorkOrders: ordersSummary.activeStopWorkCount,
      },
      recentInspections: recentInspections.map((row) => ({
        id: row.id,
        permitId: row.permit?.permitNumber ?? row.id,
        status: row.status,
        inspectorName: row.schedule?.assignedTo?.name ?? 'Unassigned',
        updatedAt: row.updatedAt.toISOString(),
      })),
      pendingAssignments: unassignedSchedules.map((schedule) => ({
        id: schedule.id,
        permitId: schedule.inspection.permit?.permitNumber ?? schedule.inspectionId,
        assignedTo: schedule.assignedTo.name,
        dueDate: schedule.assignedDate.toISOString(),
      })),
      stopWorkAlerts: ordersSummary.recentAlerts,
    }
  }

  async getInspectionMonitorPayload() {
    const stopWorkInspectionIds = new Set(
      (
        await prisma.deficiency.findMany({
          where: { isStopWork: true, status: { not: 'CLOSED' } },
          select: { inspectionId: true },
        })
      ).map((d) => d.inspectionId),
    )

    const rows = await prisma.permitInspection.findMany({
      where: { status: { in: ['SCHEDULED', 'IN_PROGRESS', 'PASSED', 'FAILED'] } },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      include: {
        permit: { select: { permitNumber: true } },
        schedule: { include: { assignedTo: { select: { name: true } } } },
      },
    })

    const now = Date.now()
    const offlineThresholdMs = 15 * 60 * 1000

    return {
      generatedAt: new Date().toISOString(),
      inspections: rows.map((row) => {
        const updatedAt = row.updatedAt
        const stale = now - updatedAt.getTime() > offlineThresholdMs
        const syncStatus = stale ? ('OFFLINE' as const) : ('SYNCED' as const)
        return {
          id: row.id,
          permitId: row.permit?.permitNumber ?? row.id,
          status: mapMonitorStatus(row.status),
          inspectorName: row.schedule?.assignedTo?.name ?? 'Unassigned',
          syncStatus,
          pendingSubmission: row.status === 'SCHEDULED',
          stopWorkAlert: stopWorkInspectionIds.has(row.id),
          updatedAt: updatedAt.toISOString(),
        }
      }),
    }
  }
}

export const adminDashboardService = new AdminDashboardService()
