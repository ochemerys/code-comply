import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/client', () => ({
  api: {
    admin: {
      orders: {
        dashboard: {
          $get: vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
              stats: {
                activeInspectors: 3,
                pendingInspections: 5,
                completedToday: 1,
                stopWorkOrders: 0,
              },
              recentInspections: [
                {
                  id: 'insp-1',
                  permitId: 'P-1',
                  status: 'IN_PROGRESS',
                  inspectorName: 'Alex',
                  updatedAt: new Date().toISOString(),
                },
              ],
              pendingAssignments: [
                {
                  id: 'asg-1',
                  permitId: 'P-2',
                  assignedTo: 'Sam',
                  dueDate: new Date().toISOString(),
                },
              ],
              stopWorkAlerts: [],
            }),
          }),
        },
      },
    },
  },
}))

import { fetchAdminDashboardPayload } from './useAdminDashboard'

describe('fetchAdminDashboardPayload', () => {
  it('returns stats, inspections, and assignments from the API', async () => {
    const data = await fetchAdminDashboardPayload()
    expect(data.stats.activeInspectors).toBe(3)
    expect(data.recentInspections.length).toBe(1)
    expect(data.pendingAssignments.length).toBe(1)
    expect(data.stopWorkAlerts).toEqual([])
  })
})
