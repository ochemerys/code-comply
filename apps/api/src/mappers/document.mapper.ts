import type { DocumentDTO } from '@codecomply/validators'
import type { Document } from '../services/document.service.js'

export const DocumentMapper = {
  toDTO(doc: Document): DocumentDTO {
    return {
      id: doc.id,
      inspectionId: doc.inspectionId,
      filename: doc.filename,
      mimeType: doc.mimeType,
      size: doc.size,
      metadata: doc.metadata,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    }
  },

  toDTOs(docs: Document[]): DocumentDTO[] {
    return docs.map((d) => DocumentMapper.toDTO(d))
  },
}
