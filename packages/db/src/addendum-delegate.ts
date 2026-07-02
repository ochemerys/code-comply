/** Row shape for `Addendum` when generated `PrismaClient` omits the delegate (stale generate / IDE). */
export type AddendumRow = {
  id: string
  inspectionId: string
  reason: string
  content: string
  createdById: string
  createdAt: Date
  signature: string | null
}

export type AddendumDelegate = {
  create: (args: object) => Promise<AddendumRow>
  deleteMany: (args?: object) => Promise<unknown>
  findMany: (args?: object) => Promise<AddendumRow[]>
  findUnique: (args: object) => Promise<AddendumRow | null>
  findUniqueOrThrow: (args: object) => Promise<AddendumRow>
}

/** Resolve `addendum` on a Prisma client or transaction client. */
export function addendumDelegateOf(client: unknown): AddendumDelegate {
  const delegate = (client as { addendum?: AddendumDelegate }).addendum
  if (!delegate) {
    throw new Error('Prisma addendum delegate missing; run `pnpm db:generate`')
  }
  return delegate
}
