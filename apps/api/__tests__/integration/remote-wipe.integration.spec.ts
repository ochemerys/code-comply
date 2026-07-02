import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import type { User } from '@codecomply/db'
import { authService } from '../../src/services/auth.service.js'
import { remoteWipeService } from '../../src/services/remote-wipe.service.js'
import { AUDIT_ACTION, auditLogService } from '../../src/services/audit-log.service.js'

vi.mock('../../src/services/auth.service.js', () => ({
  authService: { validateToken: vi.fn() },
}))

vi.mock('../../src/services/remote-wipe.service.js', () => ({
  remoteWipeService: {
    requestRemoteWipe: vi.fn(),
    getWipeStatus: vi.fn(),
    confirmRemoteWipe: vi.fn(),
  },
  isRemoteWipePending: vi.fn((user: { remoteWipeRequestedAt?: Date | null }) =>
    Boolean(user.remoteWipeRequestedAt),
  ),
}))

vi.mock('../../src/services/audit-log.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/audit-log.service.js')>()
  return {
    ...actual,
    auditLogService: { append: vi.fn().mockResolvedValue({ id: 'audit-wipe-int' }) },
  }
})

const adminUser = {
  id: 'admin-wipe-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN',
} as User

const scoUser = {
  id: 'sco-wipe-1',
  email: 'sco@example.com',
  name: 'SCO',
  role: 'SCO',
} as User

const scoPendingWipe = {
  ...scoUser,
  remoteWipeRequestedAt: new Date('2026-05-19T10:00:00Z'),
} as User

describe('Remote wipe integration (M11-S4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('admin can trigger remote wipe for inspector', async () => {
    vi.mocked(authService.validateToken).mockResolvedValue(adminUser)
    vi.mocked(remoteWipeService.requestRemoteWipe).mockResolvedValue({
      ...scoUser,
      remoteWipeRequestedAt: new Date('2026-05-19T10:00:00Z'),
    } as User)

    const { app } = await import('../../src/app.js')
    const res = await app.request('/api/admin/users/sco-wipe-1/remote-wipe', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      message: 'Remote wipe requested',
      userId: expect.any(String),
    })
    expect(remoteWipeService.requestRemoteWipe).toHaveBeenCalledWith('sco-wipe-1', 'admin-wipe-1')
  })

  it('inspector can read wipe status when pending', async () => {
    vi.mocked(authService.validateToken).mockResolvedValue(scoPendingWipe)
    vi.mocked(remoteWipeService.getWipeStatus).mockResolvedValue({
      pending: true,
      message: 'Device wiped by administrator',
    })

    const { app } = await import('../../src/app.js')
    const res = await app.request('/api/device/remote-wipe/status', {
      headers: { Authorization: 'Bearer sco-token' },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      pending: true,
      message: 'Device wiped by administrator',
    })
  })

  it('inspector with pending wipe is blocked from sync API', async () => {
    vi.mocked(authService.validateToken).mockResolvedValue(scoPendingWipe)

    const { app } = await import('../../src/app.js')
    const res = await app.request('/api/sync/pull', {
      headers: { Authorization: 'Bearer sco-token' },
    })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('RemoteWipePending')
  })

  it('inspector can confirm remote wipe', async () => {
    vi.mocked(authService.validateToken).mockResolvedValue(scoPendingWipe)
    vi.mocked(remoteWipeService.confirmRemoteWipe).mockResolvedValue({
      ...scoUser,
      remoteWipeConfirmedAt: new Date('2026-05-19T11:00:00Z'),
    } as User)

    const { app } = await import('../../src/app.js')
    const res = await app.request('/api/device/remote-wipe/confirm', {
      method: 'POST',
      headers: { Authorization: 'Bearer sco-token' },
    })

    expect(res.status).toBe(200)
    expect(remoteWipeService.confirmRemoteWipe).toHaveBeenCalledWith('sco-wipe-1')
    expect(auditLogService.append).not.toHaveBeenCalled()
  })
})
