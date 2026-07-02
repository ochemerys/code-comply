/**
 * DB row type for `InspectionDocument` (table `inspection_documents`).
 * Defined here so consumers do not depend on `export type { InspectionDocument } from '@prisma/client'`
 * (missing when the client is stale or not surfaced by TS package exports).
 */
export type InspectionDocument = {
  id: string
  inspectionId: string
  filename: string
  mimeType: string
  size: number
  storageKey: string
  metadata: import('@prisma/client').Prisma.JsonValue
  createdAt: Date
  updatedAt: Date
}

export type { Prisma } from '@prisma/client'
export { inspectionDocumentDelegate } from './inspection-document-delegate.js'
export { addendumDelegateOf, type AddendumRow, type AddendumDelegate } from './addendum-delegate.js'
export { persistReportSignature, type ReportSigningFields } from './report-signing.js'
export * from './client.js'
