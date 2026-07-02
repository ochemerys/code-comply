import type { InspectionSchedule, Prisma, User } from '@codecomply/db'
import { prisma } from '@codecomply/db'
import {
  computeDailyAvailability,
  DEFAULT_MAX_ASSIGNMENTS_PER_DAY,
  inferDisciplineFromScope,
} from '@codecomply/validators'
import { pushNotificationService } from './push-notification.service.js'

/** `User` from the client may omit `isActive` until `prisma generate` matches the schema. */
type UserWithLifecycle = User & { isActive?: boolean }

/** Domain alias: an assignment is persisted as `InspectionSchedule`. */
export type Assignment = InspectionSchedule

export type BulkAssignmentDTO = {
  items: Array<{ inspectionId: string; userId: string }>
}

export type DateRange = {
  from: Date
  to: Date
}

export type Workload = {
  userId: string
  scheduledCount: number
  inspections: Array<{
    inspectionId: string
    scheduledDate: Date
    status: string
  }>
}

const DEFAULT_WORKLOAD_PAGE_SIZE = 100

function startOfUtcDay(d: Date): Date {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

function endOfUtcDay(d: Date): Date {
  const x = new Date(d)
  x.setUTCHours(23, 59, 59, 999)
  return x
}

export class AssignmentService {
  /**
   * Create or update the schedule row for an inspection (one assignee per inspection).
   */
  async assign(
    inspectionId: string,
    userId: string,
    options?: { scheduledDate?: Date },
  ): Promise<Assignment> {
    const inspection = await prisma.permitInspection.findUnique({
      where: { id: inspectionId },
    })
    if (!inspection) {
      throw new Error('Inspection not found')
    }

    const assigneeRaw = await prisma.user.findUnique({ where: { id: userId } })
    if (!assigneeRaw) {
      throw new Error('User not found')
    }
    const assignee = assigneeRaw as UserWithLifecycle
    if (!assignee.isActive) {
      throw new Error('Cannot assign to an inactive user')
    }

    const assignedDate = options?.scheduledDate ?? new Date()

    if (options?.scheduledDate) {
      await prisma.permitInspection.update({
        where: { id: inspectionId },
        data: { scheduledDate: options.scheduledDate },
      })
    }

    const schedule = await prisma.inspectionSchedule.upsert({
      where: { inspectionId },
      create: {
        inspectionId,
        assignedToId: userId,
        assignedDate,
      },
      update: {
        assignedToId: userId,
        assignedDate,
      },
    })

    void this.notifyAssignmentPush(userId, inspectionId)

    return schedule
  }

  private async notifyAssignmentPush(userId: string, inspectionId: string): Promise<void> {
    try {
      const inspection = await prisma.permitInspection.findUnique({
        where: { id: inspectionId },
        select: { permitId: true },
      })
      if (!inspection?.permitId) return
      await pushNotificationService.sendNewAssignmentNotification(userId, inspection.permitId)
    } catch (err) {
      console.warn('[push] assignment notification failed', err)
    }
  }

  async bulkAssign(dto: BulkAssignmentDTO): Promise<Assignment[]> {
    if (!dto.items.length) {
      return []
    }

    const inspectionIds = [...new Set(dto.items.map((i) => i.inspectionId))]
    const found = await prisma.permitInspection.findMany({
      where: { id: { in: inspectionIds } },
      select: { id: true },
    })
    if (found.length !== inspectionIds.length) {
      const ok = new Set(found.map((f) => f.id))
      const missing = inspectionIds.filter((id) => !ok.has(id))
      throw new Error(`Inspection not found: ${missing[0]}`)
    }

    const userIds = [...new Set(dto.items.map((i) => i.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, isActive: true } as Prisma.UserWhereInput,
      select: { id: true },
    })
    if (users.length !== userIds.length) {
      throw new Error('One or more assignees were not found or are inactive')
    }

    const ops = dto.items.map((item) =>
      prisma.inspectionSchedule.upsert({
        where: { inspectionId: item.inspectionId },
        create: {
          inspectionId: item.inspectionId,
          assignedToId: item.userId,
          assignedDate: new Date(),
        },
        update: {
          assignedToId: item.userId,
          assignedDate: new Date(),
        },
      }),
    )

    const schedules = await prisma.$transaction(ops)

    for (const item of dto.items) {
      void this.notifyAssignmentPush(item.userId, item.inspectionId)
    }

    return schedules
  }

  async reassign(assignmentId: string, newUserId: string): Promise<Assignment> {
    const row = await prisma.inspectionSchedule.findUnique({ where: { id: assignmentId } })
    if (!row) {
      throw new Error('Assignment not found')
    }

    const assigneeRaw = await prisma.user.findUnique({ where: { id: newUserId } })
    if (!assigneeRaw) {
      throw new Error('User not found')
    }
    const assignee = assigneeRaw as UserWithLifecycle
    if (!assignee.isActive) {
      throw new Error('Cannot assign to an inactive user')
    }

    return prisma.inspectionSchedule.update({
      where: { id: assignmentId },
      data: {
        assignedToId: newUserId,
        assignedDate: new Date(),
      },
    })
  }

  async getWorkload(
    userId: string,
    dateRange: DateRange,
    limit = DEFAULT_WORKLOAD_PAGE_SIZE,
  ): Promise<Workload> {
    const schedules = await prisma.inspectionSchedule.findMany({
      where: {
        assignedToId: userId,
        assignedDate: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      },
      include: {
        inspection: { select: { status: true } },
      },
      orderBy: { assignedDate: 'asc' },
      take: limit,
    })

    return {
      userId,
      scheduledCount: schedules.length,
      inspections: schedules.map((s) => ({
        inspectionId: s.inspectionId,
        scheduledDate: s.assignedDate,
        status: s.inspection.status,
      })),
    }
  }

  /**
   * Active SCOs with fewer than `maxPerDay` scheduled assignments on the given UTC calendar day.
   * Uses a single groupBy query instead of per-user counts (M11-S11 N+1 fix).
   */
  private inspectionLabel(notes: string | null, status: string): string {
    const trimmed = notes?.trim()
    if (trimmed) return trimmed
    return status
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase())
  }

  private toIsoDateUtc(d: Date): string {
    return d.toISOString().slice(0, 10)
  }

  async getGridData(from: Date, to: Date) {
    const inspectors = await prisma.user.findMany({
      where: { role: 'SCO', isActive: true } as Prisma.UserWhereInput,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, disciplines: true },
    })

    const unassignedRows = await prisma.permitInspection.findMany({
      where: {
        status: 'SCHEDULED',
        schedule: null,
        permitId: { not: null },
      },
      include: { permit: { select: { permitNumber: true, scope: true } } },
      orderBy: { scheduledDate: 'asc' },
      take: 100,
    })

    const assignedRows = await prisma.permitInspection.findMany({
      where: {
        schedule: { isNot: null },
        scheduledDate: { gte: from, lte: to },
        permitId: { not: null },
      },
      include: {
        permit: { select: { permitNumber: true, scope: true } },
        schedule: { select: { id: true, assignedToId: true } },
      },
      orderBy: { scheduledDate: 'asc' },
      take: 500,
    })

    const assignments = assignedRows
      .filter((row) => row.schedule)
      .map((row) => ({
        id: row.schedule!.id,
        inspectionId: row.id,
        permitId: row.permit?.permitNumber ?? 'N/A',
        label: this.inspectionLabel(row.notes, row.status),
        description: row.permit?.scope ?? '',
        discipline: inferDisciplineFromScope(row.permit?.scope ?? ''),
        inspectorId: row.schedule!.assignedToId,
        isoDate: this.toIsoDateUtc(row.scheduledDate),
      }))

    const countByCell = new Map<string, number>()
    for (const a of assignments) {
      const key = `${a.inspectorId}:${a.isoDate}`
      countByCell.set(key, (countByCell.get(key) ?? 0) + 1)
    }

    const dailyLoads: Array<{
      inspectorId: string
      isoDate: string
      count: number
      maxPerDay: number
      atCapacity: boolean
      overCapacity: boolean
      guidance: string[]
    }> = []

    for (const insp of inspectors) {
      const dayMs = 24 * 60 * 60 * 1000
      for (let t = from.getTime(); t <= to.getTime(); t += dayMs) {
        const isoDate = this.toIsoDateUtc(new Date(t))
        const count = countByCell.get(`${insp.id}:${isoDate}`) ?? 0
        if (count === 0) continue
        dailyLoads.push({
          inspectorId: insp.id,
          isoDate,
          ...computeDailyAvailability(count, DEFAULT_MAX_ASSIGNMENTS_PER_DAY),
        })
      }
    }

    return {
      inspectors: inspectors.map((insp) => ({
        id: insp.id,
        name: insp.name,
        disciplines: insp.disciplines ?? [],
      })),
      unassigned: unassignedRows.map((row) => ({
        id: row.id,
        inspectionId: row.id,
        permitId: row.permit?.permitNumber ?? 'N/A',
        label: this.inspectionLabel(row.notes, row.status),
        description: row.permit?.scope ?? '',
        discipline: inferDisciplineFromScope(row.permit?.scope ?? ''),
      })),
      assignments,
      maxAssignmentsPerDay: DEFAULT_MAX_ASSIGNMENTS_PER_DAY,
      dailyLoads,
    }
  }

  async getCalendarWorkload(from: Date, to: Date) {
    const inspectors = await prisma.user.findMany({
      where: { role: 'SCO', isActive: true } as Prisma.UserWhereInput,
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })

    const rows = await prisma.permitInspection.findMany({
      where: {
        schedule: { isNot: null },
        scheduledDate: { gte: from, lte: to },
        permitId: { not: null },
      },
      include: {
        permit: { select: { permitNumber: true } },
        schedule: { select: { assignedToId: true } },
      },
      orderBy: { scheduledDate: 'asc' },
      take: 500,
    })

    const events = rows
      .filter((row) => row.schedule)
      .map((row) => ({
        id: row.id,
        inspectionId: row.id,
        permitId: row.permit?.permitNumber ?? 'N/A',
        title: this.inspectionLabel(row.notes, row.status),
        start: row.scheduledDate.toISOString(),
        inspectorId: row.schedule!.assignedToId,
        status: row.status.toLowerCase(),
      }))

    return { inspectors, events }
  }

  async getAvailableInspectors(
    date: Date,
    maxPerDay = DEFAULT_MAX_ASSIGNMENTS_PER_DAY,
  ): Promise<User[]> {
    const from = startOfUtcDay(date)
    const to = endOfUtcDay(date)

    const candidates = await prisma.user.findMany({
      where: { role: 'SCO', isActive: true } as Prisma.UserWhereInput,
      orderBy: { name: 'asc' },
    })

    if (candidates.length === 0) {
      return []
    }

    const counts = await prisma.inspectionSchedule.groupBy({
      by: ['assignedToId'],
      where: {
        assignedToId: { in: candidates.map((u) => u.id) },
        assignedDate: { gte: from, lte: to },
      },
      _count: { _all: true },
    })

    const countByUser = new Map(counts.map((row) => [row.assignedToId, row._count._all]))

    return candidates.filter((u) => (countByUser.get(u.id) ?? 0) < maxPerDay)
  }
}

export const assignmentService = new AssignmentService()
