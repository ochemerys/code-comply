import type { User } from '@codecomply/db'
import { prisma } from '@codecomply/db'
import { AUDIT_ACTION, AUDIT_ENTITY, auditLogService } from './audit-log.service.js'

export type UserWithRemoteWipe = User & {
  remoteWipeRequestedAt?: Date | null
  remoteWipeConfirmedAt?: Date | null
}

export function isRemoteWipePending(user: UserWithRemoteWipe): boolean {
  const requestedAt = user.remoteWipeRequestedAt
  if (!requestedAt) return false
  const confirmedAt = user.remoteWipeConfirmedAt
  if (!confirmedAt) return true
  return confirmedAt.getTime() < requestedAt.getTime()
}

export class RemoteWipeService {
  /**
   * Admin triggers a remote wipe for an inspector device.
   * Sets the wipe flag, invalidates sessions, and audit-logs the action.
   */
  async requestRemoteWipe(targetUserId: string, adminUserId: string): Promise<UserWithRemoteWipe> {
    const target = await prisma.user.findUnique({ where: { id: targetUserId } })
    if (!target) {
      throw new Error('User not found')
    }
    if (target.role !== 'SCO') {
      throw new Error('Remote wipe is only supported for inspector (SCO) accounts')
    }

    const requestedAt = new Date()
    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        remoteWipeRequestedAt: requestedAt,
        remoteWipeConfirmedAt: null,
      },
    })

    await auditLogService.append({
      entityType: AUDIT_ENTITY.SECURITY,
      entityId: targetUserId,
      action: AUDIT_ACTION.REMOTE_WIPE_REQUESTED,
      userId: adminUserId,
      metadata: {
        targetUserId,
        targetEmail: target.email,
        requestedAt: requestedAt.toISOString(),
      },
    })

    return updated as UserWithRemoteWipe
  }

  async getWipeStatus(userId: string): Promise<{ pending: boolean; message?: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new Error('User not found')
    }
    const pending = isRemoteWipePending(user as UserWithRemoteWipe)
    return {
      pending,
      message: pending ? 'Device wiped by administrator' : undefined,
    }
  }

  /**
   * Inspector device confirms wipe completed after clearing local storage.
   */
  async confirmRemoteWipe(userId: string): Promise<UserWithRemoteWipe> {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new Error('User not found')
    }
    if (!isRemoteWipePending(user as UserWithRemoteWipe)) {
      throw new Error('No pending remote wipe for this user')
    }

    const confirmedAt = new Date()
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        remoteWipeConfirmedAt: confirmedAt,
      },
    })

    await auditLogService.append({
      entityType: AUDIT_ENTITY.SECURITY,
      entityId: userId,
      action: AUDIT_ACTION.REMOTE_WIPE_CONFIRMED,
      userId,
      metadata: {
        confirmedAt: confirmedAt.toISOString(),
        requestedAt: (user as UserWithRemoteWipe).remoteWipeRequestedAt?.toISOString() ?? null,
      },
    })

    await prisma.session.deleteMany({ where: { userId } })

    return updated as UserWithRemoteWipe
  }
}

export const remoteWipeService = new RemoteWipeService()
