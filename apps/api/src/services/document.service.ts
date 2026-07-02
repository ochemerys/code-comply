import { randomUUID } from 'node:crypto'
import {
  inspectionDocumentDelegate,
  type InspectionDocument as InspectionDocumentRow,
  type Prisma,
} from '@codecomply/db'
import {
  createObjectStorageClientFromEnv,
  type ObjectStorageClient,
} from '../lib/storage/storage-client.js'
import { sanitizeFilename } from '../lib/sanitization.js'

/** Default lifetime for presigned GET URLs (seconds). */
export const DOCUMENT_SIGNED_URL_TTL_SECONDS = 3600

/**
 * Client-supplied metadata for an upload. `inspectionId` identifies the parent inspection;
 * other fields are persisted in the `metadata` JSON column.
 */
export type DocumentMetadata = {
  inspectionId: string
  title?: string
  description?: string
  category?: string
}

export type Document = {
  id: string
  inspectionId: string
  filename: string
  mimeType: string
  size: number
  storageKey: string
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

function toDomain(row: InspectionDocumentRow): Document {
  const meta = row.metadata
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    storageKey: row.storageKey,
    metadata: typeof meta === 'object' && meta !== null && !Array.isArray(meta) ? { ...meta } : {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

let defaultObjectStorage: ObjectStorageClient | undefined

function getDefaultObjectStorage(): ObjectStorageClient {
  if (!defaultObjectStorage) {
    defaultObjectStorage = createObjectStorageClientFromEnv()
  }
  return defaultObjectStorage
}

/**
 * Domain service for inspection documents: R2 (documents bucket) + Postgres metadata (M7-S8).
 */
export class DocumentService {
  constructor(private readonly injectedStorage?: ObjectStorageClient) {}

  private storage(): ObjectStorageClient {
    return this.injectedStorage ?? getDefaultObjectStorage()
  }

  async getById(documentId: string): Promise<Document | null> {
    const row = await inspectionDocumentDelegate.findUnique({ where: { id: documentId } })
    return row ? toDomain(row) : null
  }

  async upload(file: File, metadata: DocumentMetadata): Promise<Document> {
    const inspectionId = metadata.inspectionId?.trim()
    if (!inspectionId) {
      throw new Error('DocumentMetadata.inspectionId is required')
    }

    const { inspectionId: _id, ...metaRest } = metadata
    const body = Buffer.from(await file.arrayBuffer())
    const mimeType = file.type?.trim() || 'application/octet-stream'
    const storageKey = `${inspectionId}/${randomUUID()}-${sanitizeFilename(file.name)}`

    await this.storage().putObject('documents', storageKey, body, mimeType)

    const row = await inspectionDocumentDelegate.create({
      data: {
        inspectionId,
        filename: file.name,
        mimeType,
        size: body.byteLength,
        storageKey,
        metadata: metaRest as Prisma.InputJsonValue,
      },
    })

    return toDomain(row)
  }

  async getSignedUrl(documentId: string): Promise<string> {
    const row = await inspectionDocumentDelegate.findUnique({ where: { id: documentId } })
    if (!row) {
      throw new Error('Document not found')
    }
    return this.storage().getSignedGetUrl(
      'documents',
      row.storageKey,
      DOCUMENT_SIGNED_URL_TTL_SECONDS,
    )
  }

  async delete(documentId: string): Promise<void> {
    const row = await inspectionDocumentDelegate.findUnique({ where: { id: documentId } })
    if (!row) {
      throw new Error('Document not found')
    }
    await this.storage().deleteObject('documents', row.storageKey)
    await inspectionDocumentDelegate.delete({ where: { id: documentId } })
  }

  async getByInspection(inspectionId: string): Promise<Document[]> {
    const rows = await inspectionDocumentDelegate.findMany({
      where: { inspectionId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toDomain)
  }
}

export const documentService = new DocumentService()
