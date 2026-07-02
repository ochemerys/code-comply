import { PrismaClient } from '@prisma/client'

/** Fields used by photo tests; avoids generated `Prisma.PhotoDelegate` when client types lag. */
export type IntegrationPhotoRow = {
  inspectionId: string
  filename: string
  storageKey: string | null
  syncedAt: Date | null
}

/** Fields read in photo unit tests after create/findUnique. */
export type IntegrationPhotoModel = {
  id: string
  storageKey: string | null
  metadata: unknown
  annotations: unknown
  syncedAt: Date | null
  deficiencyId: string | null
}

type IntegrationPhotoDelegate = {
  deleteMany: (args?: { where?: object }) => Promise<unknown>
  createMany: (args: object) => Promise<unknown>
  findMany: (args?: object) => Promise<IntegrationPhotoRow[]>
  create: (args: object) => Promise<IntegrationPhotoModel>
  findUnique: (args: object) => Promise<IntegrationPhotoModel | null>
  findUniqueOrThrow: (args: object) => Promise<IntegrationPhotoModel>
}

/**
 * `new PrismaClient()` with `photo` on the type — use when `PrismaClient` is resolved without
 * the generated `photo` delegate (stale generate / IDE resolution).
 */
export function prismaForDbTests(): PrismaClient & { photo: IntegrationPhotoDelegate } {
  return new PrismaClient() as PrismaClient & { photo: IntegrationPhotoDelegate }
}

/** VoC delegate — explicit surface when `PrismaClient` omits `verificationOfCompliance` (stale generate / IDE). */
export type VerificationOfComplianceIntegrationDelegate = {
  create: (args: object) => Promise<{ id: string }>
  findUniqueOrThrow: (args: object) => Promise<unknown>
  findUnique: (args: object) => Promise<{ id: string } | null>
  update: (args: object) => Promise<unknown>
}

export function prismaForVocIntegrationTests(): PrismaClient & {
  verificationOfCompliance: VerificationOfComplianceIntegrationDelegate
} {
  return new PrismaClient() as PrismaClient & {
    verificationOfCompliance: VerificationOfComplianceIntegrationDelegate
  }
}
