import { PrismaClient } from '@prisma/client'

/**
 * No `log` in ctor: passing `log` narrows `PrismaClient` generics so TS often drops model delegates
 * (e.g. `inspectionDocument`) while still using `DefaultArgs`. Use `DEBUG` / server logging instead if needed.
 */
function createPrismaClient() {
  return new PrismaClient()
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export * from '@prisma/client'
