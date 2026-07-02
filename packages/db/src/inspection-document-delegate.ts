import { prisma } from './client.js'

/**
 * Same runtime object as `prisma.inspectionDocument`. `(prisma as any)` avoids TS resolving `PrismaClient`
 * without generated model delegates; run `pnpm db:generate` if the property is missing at runtime.
 */
export const inspectionDocumentDelegate = (prisma as any).inspectionDocument
