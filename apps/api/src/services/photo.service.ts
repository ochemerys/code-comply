import { randomUUID } from 'node:crypto'
import { prisma } from '@codecomply/db'
import type { Photo as PhotoRow, Prisma } from '@prisma/client'
import {
  createObjectStorageClientFromEnv,
  type ObjectStorageClient,
} from '../lib/storage/storage-client.js'
import { inspectionService } from './inspection.service.js'
import { AUDIT_ACTION, AUDIT_ENTITY, auditLogService } from './audit-log.service.js'

/** Multipart uploads max body size (aligned with documents route). */
export const MAX_PHOTO_UPLOAD_BYTES = 10 * 1024 * 1024

export type Photo = {
  id: string
  clientId: string
  inspectionId: string
  deficiencyId: string | null
  filename: string
  mimeType: string
  size: number
  storageKey: string | null
  metadata: Record<string, unknown>
  annotations: Prisma.JsonValue | null
  createdAt: Date
  syncedAt: Date | null
}

function safeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'upload'
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180)
  return cleaned.length > 0 ? cleaned : 'upload'
}

function toDomain(row: PhotoRow): Photo {
  const meta = row.metadata
  return {
    id: row.id,
    clientId: row.clientId,
    inspectionId: row.inspectionId,
    deficiencyId: row.deficiencyId,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    storageKey: row.storageKey,
    metadata:
      typeof meta === 'object' && meta !== null && !Array.isArray(meta)
        ? { ...(meta as Record<string, unknown>) }
        : {},
    annotations: row.annotations ?? null,
    createdAt: row.createdAt,
    syncedAt: row.syncedAt,
  }
}

let defaultObjectStorage: ObjectStorageClient | undefined

function getDefaultObjectStorage(): ObjectStorageClient {
  if (!defaultObjectStorage) {
    defaultObjectStorage = createObjectStorageClientFromEnv()
  }
  return defaultObjectStorage
}

export class PhotoService {
  constructor(private readonly injectedStorage?: ObjectStorageClient) {}

  private storage(): ObjectStorageClient {
    return this.injectedStorage ?? getDefaultObjectStorage()
  }

  async upload(
    file: File,
    input: {
      clientId: string
      inspectionId: string
      deficiencyId?: string
      checklistItemId?: string
      metadata: Record<string, unknown>
      annotations?: string | null
    },
    userId: string,
  ): Promise<{ photo: Photo; created: boolean }> {
    const startTime = Date.now()
    const clientId = input.clientId?.trim()
    if (!clientId) {
      throw new Error('clientId is required')
    }

    const inspectionId = input.inspectionId?.trim()
    if (!inspectionId) {
      throw new Error('inspectionId is required')
    }

    console.log(
      `[PhotoService] Upload attempt: inspection=${inspectionId} ` +
        `user=${userId} size=${file.size} clientId=${clientId}`,
    )

    try {
      const inspection = await inspectionService.getById(inspectionId, userId)
      if (!inspection) {
        throw new Error('Inspection not found')
      }

      const deficiencyId = input.deficiencyId?.trim()
      if (deficiencyId) {
        const def = await prisma.deficiency.findFirst({
          where: { id: deficiencyId, inspectionId },
        })
        if (!def) {
          throw new Error('Deficiency not found for inspection')
        }
      }

      const metadata: Record<string, unknown> = { ...input.metadata }
      if (input.checklistItemId?.trim()) {
        metadata.checklistItemId = input.checklistItemId.trim()
      }

      const hasAnnotations =
        input.annotations !== undefined && input.annotations !== null && input.annotations !== ''

      // Use upsert to handle race conditions atomically
      const row = await prisma.photo.upsert({
        where: { clientId },
        update: {}, // Return existing if found
        create: {
          clientId,
          inspectionId,
          ...(deficiencyId ? { deficiencyId } : {}),
          filename: file.name || safeFilename(file.name),
          mimeType: file.type?.trim() || 'application/octet-stream',
          size: 0, // Will be updated after upload
          storageKey: null, // Will be set after upload
          metadata: metadata as Prisma.InputJsonValue,
          ...(hasAnnotations ? { annotations: input.annotations as Prisma.InputJsonValue } : {}),
          syncedAt: null,
        },
      })

      // Verify the photo belongs to the correct inspection
      if (row.inspectionId !== inspectionId) {
        throw new Error('Photo clientId already exists for another inspection')
      }

      // Check if this is a new photo that needs storage upload
      const isNew = !row.storageKey
      if (isNew) {
        const body = Buffer.from(await file.arrayBuffer())
        const mimeType = file.type?.trim() || 'application/octet-stream'
        const storageKey = `${inspectionId}/${randomUUID()}-${safeFilename(file.name)}`

        try {
          await this.storage().putObject('photos', storageKey, body, mimeType)

          // Update the row with storage information
          const updated = await prisma.photo.update({
            where: { id: row.id },
            data: {
              storageKey,
              size: body.byteLength,
              mimeType,
              syncedAt: new Date(),
            },
          })

          const duration = Date.now() - startTime
          console.log(
            `[PhotoService] Upload created: id=${updated.id} ` +
              `storageKey=${storageKey} duration=${duration}ms`,
          )

          await auditLogService.append({
            entityType: AUDIT_ENTITY.PERMIT_INSPECTION,
            entityId: inspectionId,
            action: AUDIT_ACTION.PHOTO_ADDED,
            userId,
            beforeData: null,
            afterData: {
              photoId: updated.id,
              clientId: updated.clientId,
              deficiencyId: updated.deficiencyId,
              filename: updated.filename,
              mimeType: updated.mimeType,
              size: updated.size,
              storageKey: updated.storageKey,
            },
            metadata: { photoEntityId: updated.id },
          })

          return { photo: toDomain(updated), created: true }
        } catch (err) {
          // If storage upload or DB update fails, clean up the database row
          try {
            await prisma.photo.delete({ where: { id: row.id } })
          } catch (cleanupErr) {
            console.error(`Failed to cleanup photo row ${row.id} after upload failure:`, cleanupErr)
          }
          throw err
        }
      }

      const duration = Date.now() - startTime
      console.log(
        `[PhotoService] Upload idempotent: id=${row.id} ` +
          `clientId=${clientId} duration=${duration}ms`,
      )

      return { photo: toDomain(row), created: false }
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(
        `[PhotoService] Upload failed: inspection=${inspectionId} ` +
          `user=${userId} duration=${duration}ms error=${error}`,
      )
      throw error
    }
  }

  /**
   * Idempotent delete: resolves photo by server id, or by `clientId` query when the path id
   * is still a client-local identifier. No-op when the photo does not exist.
   */
  async deleteByLookup(
    pathId: string,
    queryClientId: string | undefined,
    userId: string,
  ): Promise<void> {
    const startTime = Date.now()
    const path = pathId?.trim()
    if (!path) {
      return
    }

    const qClient = queryClientId?.trim()

    console.log(
      `[PhotoService] Delete attempt: pathId=${path} ` +
        `clientId=${qClient || 'none'} user=${userId}`,
    )

    try {
      const photo =
        (await prisma.photo.findUnique({ where: { id: path } })) ??
        (qClient ? await prisma.photo.findUnique({ where: { clientId: qClient } }) : null)

      if (!photo) {
        const duration = Date.now() - startTime
        console.log(
          `[PhotoService] Delete idempotent (not found): pathId=${path} duration=${duration}ms`,
        )
        return
      }

      const inspection = await inspectionService.getById(photo.inspectionId, userId)
      if (!inspection) {
        throw new Error('Inspection not found')
      }

      const key = photo.storageKey
      // Delete metadata first to avoid orphaned storage objects
      // eslint-disable-next-line no-useless-catch
      try {
        await prisma.photo.delete({ where: { id: photo.id } })

        // Then delete storage object
        if (key) {
          try {
            await this.storage().deleteObject('photos', key)
          } catch (storageErr) {
            // Log but don't fail - storage cleanup can be retried
            console.error(`Failed to delete storage object ${key}:`, storageErr)
          }
        }

        const duration = Date.now() - startTime
        console.log(
          `[PhotoService] Delete success: id=${photo.id} ` +
            `storageKey=${key || 'none'} duration=${duration}ms`,
        )
      } catch (dbErr) {
        // Database deletion failed - storage object still exists and can be cleaned up later
        throw dbErr
      }
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(
        `[PhotoService] Delete failed: pathId=${path} ` +
          `user=${userId} duration=${duration}ms error=${error}`,
      )
      throw error
    }
  }
}

export const photoService = new PhotoService()
