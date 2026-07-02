import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { User } from '@codecomply/db'
import { prisma } from '@codecomply/db'
import { RemoteWipeService, isRemoteWipePending, remoteWipeService } from './remote-wipe.service.js'
import { AUDIT_ACTION, AUDIT_ENTITY, auditLogService } from './audit-log.service.js'

vi.mock('@codecomply/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('./audit-log.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./audit-log.service.js')>()
  return {
    ...actual,
    auditLogService: { append: vi.fn().mockResolvedValue({ id: 'audit-wipe-1' }) },
  }
})

const scoUser = {
  id: 'sco-1',
  email: 'sco@test.com',
  name: 'SCO',
  role: 'SCO',
  remoteWipeRequestedAt: null,
  remoteWipeConfirmedAt: null,
} as User & { remoteWipeRequestedAt: Date | null; remoteWipeConfirmedAt: Date | null }

describe('isRemoteWipePending', () => {
  it('returns false when no request timestamp', () => {
    expect(isRemoteWipePending(scoUser)).toBe(false)
  })

  it('returns true when requested and not confirmed', () => {
    expect(
      isRemoteWipePending({
        ...scoUser,
        remoteWipeRequestedAt: new Date('2026-05-19T10:00:00Z'),
        remoteWipeConfirmedAt: null,
      }),
    ).toBe(true)
  })

  it('returns true when confirmed before latest request', () => {
    expect(
      isRemoteWipePending({
        ...scoUser,
        remoteWipeRequestedAt: new Date('2026-05-19T12:00:00Z'),
        remoteWipeConfirmedAt: new Date('2026-05-19T10:00:00Z'),
      }),
    ).toBe(true)
  })

  it('returns false when confirmed after request', () => {
    expect(
      isRemoteWipePending({
        ...scoUser,
        remoteWipeRequestedAt: new Date('2026-05-19T10:00:00Z'),
        remoteWipeConfirmedAt: new Date('2026-05-19T11:00:00Z'),
      }),
    ).toBe(false)
  })
})

describe('RemoteWipeService', () => {
  const service = new RemoteWipeService()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requestRemoteWipe sets flag and audit-logs', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(scoUser)
    const requestedAt = new Date('2026-05-19T10:00:00Z')
    vi.mocked(prisma.user.update).mockResolvedValue({
      ...scoUser,
      remoteWipeRequestedAt: requestedAt,
    } as User)

    const result = await service.requestRemoteWipe('sco-1', 'admin-1')

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sco-1' },
        data: expect.objectContaining({
          remoteWipeRequestedAt: expect.any(Date),
          remoteWipeConfirmedAt: null,
        }),
      }),
    )
    expect(auditLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: AUDIT_ENTITY.SECURITY,
        entityId: 'sco-1',
        action: AUDIT_ACTION.REMOTE_WIPE_REQUESTED,
        userId: 'admin-1',
      }),
    )
    expect(result.remoteWipeRequestedAt).toEqual(requestedAt)
  })

  it('requestRemoteWipe rejects non-SCO users', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...scoUser, role: 'ADMIN' } as User)
    await expect(service.requestRemoteWipe('admin-x', 'admin-1')).rejects.toThrow(
      'Remote wipe is only supported for inspector (SCO) accounts',
    )
  })

  it('confirmRemoteWipe clears pending state and deletes sessions', async () => {
    const requestedAt = new Date('2026-05-19T10:00:00Z')
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...scoUser,
      remoteWipeRequestedAt: requestedAt,
      remoteWipeConfirmedAt: null,
    } as User)
    const confirmedAt = new Date('2026-05-19T11:00:00Z')
    vi.mocked(prisma.user.update).mockResolvedValue({
      ...scoUser,
      remoteWipeRequestedAt: requestedAt,
      remoteWipeConfirmedAt: confirmedAt,
    } as User)

    await service.confirmRemoteWipe('sco-1')

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'sco-1' } })
    expect(auditLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTION.REMOTE_WIPE_CONFIRMED,
        userId: 'sco-1',
      }),
    )
  })

  it('confirmRemoteWipe fails when no pending wipe', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(scoUser)
    await expect(service.confirmRemoteWipe('sco-1')).rejects.toThrow(
      'No pending remote wipe for this user',
    )
  })

  it('getWipeStatus reports pending flag', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...scoUser,
      remoteWipeRequestedAt: new Date(),
      remoteWipeConfirmedAt: null,
    } as User)

    const status = await remoteWipeService.getWipeStatus('sco-1')
    expect(status.pending).toBe(true)
    expect(status.message).toContain('administrator')
  })
})
