import type { PhotoDTO } from '@codecomply/validators'
import type { Photo } from '../services/photo.service.js'

export const PhotoMapper = {
  toDTO(photo: Photo): PhotoDTO {
    return {
      id: photo.id,
      clientId: photo.clientId,
      inspectionId: photo.inspectionId,
      deficiencyId: photo.deficiencyId ?? undefined,
      filename: photo.filename,
      mimeType: photo.mimeType,
      size: photo.size,
      storageKey: photo.storageKey ?? undefined,
      metadata: photo.metadata,
      ...(photo.annotations !== undefined && photo.annotations !== null
        ? { annotations: photo.annotations as unknown }
        : {}),
      createdAt: photo.createdAt.toISOString(),
      syncedAt: photo.syncedAt ? photo.syncedAt.toISOString() : null,
    }
  },
}
