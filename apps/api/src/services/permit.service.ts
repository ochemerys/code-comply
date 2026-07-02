import { prisma } from '@codecomply/db'
import type { Permit, Prisma } from '@codecomply/db'

const permitInspectionInclude = {
  schedule: {
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  workflow: true,
  checklistExecutions: {
    select: { id: true, completedAt: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' as const },
  },
} satisfies Prisma.PermitInspectionInclude

const permitInspectionIncludeList = {
  schedule: {
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  workflow: true,
} satisfies Prisma.PermitInspectionInclude

/** Permit with inspections (and schedule, assignedTo) as returned by getById */
type PermitWithInspections = Prisma.PermitGetPayload<{
  include: {
    inspections: {
      include: typeof permitInspectionInclude
    }
  }
}>

/**
 * Permit Service
 *
 * Domain service for permit-related business logic.
 * Framework-agnostic - can be tested without HTTP layer.
 *
 * Responsibilities:
 * - Permit retrieval and search
 * - GPS-based permit discovery
 * - Business logic for permit access control
 */
export class PermitService {
  /**
   * Get permit by ID
   *
   * @param id - Permit ID
   * @returns Permit with inspections or null if not found
   */
  async getById(id: string): Promise<PermitWithInspections | null> {
    const permit = await prisma.permit.findUnique({
      where: { id },
      include: {
        inspections: {
          include: permitInspectionInclude,
          orderBy: {
            scheduledDate: 'desc',
          },
        },
      },
    })

    return permit
  }

  /**
   * Search permits by various criteria
   *
   * @param filters - Search filters
   * @returns Array of permits matching criteria
   */
  async search(filters: {
    permitNumber?: string
    address?: string
    status?: string
    limit?: number
    offset?: number
  }): Promise<Permit[]> {
    const where: Prisma.PermitWhereInput = {}

    // Filter by permit number (case-insensitive partial match)
    if (filters.permitNumber) {
      where.permitNumber = {
        contains: filters.permitNumber,
        mode: 'insensitive',
      }
    }

    // Filter by address (case-insensitive partial match)
    if (filters.address) {
      where.address = {
        contains: filters.address,
        mode: 'insensitive',
      }
    }

    // Filter by status
    if (filters.status) {
      where.status = filters.status as any
    }

    const permits = await prisma.permit.findMany({
      where,
      include: {
        inspections: {
          include: permitInspectionIncludeList,
          orderBy: {
            scheduledDate: 'desc',
          },
          take: 1, // Only include the most recent inspection for list view
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: filters.limit || 20,
      skip: filters.offset || 0,
    })

    return permits
  }

  /**
   * Find permits near a GPS location
   *
   * Uses the Haversine formula to calculate distance between coordinates.
   *
   * @param lat - Latitude
   * @param lng - Longitude
   * @param radius - Search radius in meters (default: 5000m = 5km)
   * @param status - Optional status filter
   * @param limit - Maximum number of results (default: 20)
   * @returns Permits within radius (sorted by distance) and total count with coordinates
   */
  async findNearby(
    lat: number,
    lng: number,
    radius: number = 5000,
    status?: string,
    limit: number = 20,
  ): Promise<{ permits: Array<Permit & { distance: number }>; totalWithCoordinates: number }> {
    if (lat < -90 || lat > 90) {
      throw new Error('Invalid latitude')
    }
    if (lng < -180 || lng > 180) {
      throw new Error('Invalid longitude')
    }
    if (radius <= 0) {
      throw new Error('Invalid radius')
    }

    // Build where clause
    const where: Prisma.PermitWhereInput = {
      // Only include permits with GPS coordinates
      latitude: { not: null },
      longitude: { not: null },
    }

    if (status) {
      where.status = status as any
    }

    // Fetch all permits with coordinates
    // Note: In production, you might want to use PostGIS or a spatial index
    // for better performance with large datasets
    const permits = await prisma.permit.findMany({
      where,
      include: {
        inspections: {
          include: permitInspectionIncludeList,
          orderBy: {
            scheduledDate: 'desc',
          },
          take: 1,
        },
      },
    })

    // Calculate distance for each permit and filter by radius
    const permitsWithDistance = permits
      .map((permit) => {
        if (!permit.latitude || !permit.longitude) {
          return null
        }

        const distance = this.calculateDistance(lat, lng, permit.latitude, permit.longitude)

        return {
          ...permit,
          distance,
        }
      })
      .filter((permit): permit is (typeof permits)[0] & { distance: number } => {
        return permit !== null && permit.distance <= radius
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)

    return {
      permits: permitsWithDistance as Array<Permit & { distance: number }>,
      totalWithCoordinates: permits.length,
    }
  }

  /**
   * Count permits that have GPS coordinates (for empty-state messaging).
   */
  async countWithCoordinates(): Promise<number> {
    return await prisma.permit.count({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
    })
  }

  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   *
   * @param lat1 - Latitude of point 1
   * @param lon1 - Longitude of point 1
   * @param lat2 - Latitude of point 2
   * @param lon2 - Longitude of point 2
   * @returns Distance in meters
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
  }

  /**
   * List all permits with pagination
   *
   * @param limit - Maximum number of results
   * @param offset - Number of results to skip
   * @returns Array of permits
   */
  async list(limit: number = 20, offset: number = 0): Promise<Permit[]> {
    return await prisma.permit.findMany({
      include: {
        inspections: {
          include: permitInspectionIncludeList,
          orderBy: {
            scheduledDate: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    })
  }

  /**
   * Permits with at least one inspection assigned to this user (inspection_schedules.assigned_to_id).
   * Inspector PWA uses this to populate the local list without relying on GPS "near me".
   */
  async findAssignedToInspector(userId: string): Promise<Permit[]> {
    const schedules = await prisma.inspectionSchedule.findMany({
      where: { assignedToId: userId },
      include: {
        inspection: {
          include: {
            permit: {
              include: {
                inspections: {
                  include: permitInspectionIncludeList,
                  orderBy: { scheduledDate: 'desc' },
                },
              },
            },
          },
        },
      },
    })

    const byId = new Map<string, Permit>()
    for (const row of schedules) {
      const permit = row.inspection.permit
      if (permit && !byId.has(permit.id)) {
        byId.set(permit.id, permit as Permit)
      }
    }

    const list = [...byId.values()]
    list.sort((a, b) => a.permitNumber.localeCompare(b.permitNumber, undefined, { numeric: true }))
    return list
  }
}

// Export singleton instance
export const permitService = new PermitService()
