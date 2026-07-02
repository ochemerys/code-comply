import { prisma, addendumDelegateOf, type AddendumDelegate } from '@codecomply/db'

type PhotoDelegate = {
  deleteMany: (args?: { where?: object }) => Promise<unknown>
}

/**
 * Integration tests import this instead of `prisma` from `@codecomply/db` so cleanup can call delegates
 * (`photo`, `addendum`, etc.) when generated `PrismaClient` types lag behind the schema.
 */
export const integrationDb = prisma as typeof prisma & {
  photo: PhotoDelegate
  addendum: AddendumDelegate
}

export { addendumDelegateOf }
