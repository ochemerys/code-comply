/**
 * M9-S4: User model admin registry fields (Prisma + Postgres).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Prisma, User } from '@prisma/client'
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

/** M9-S4 columns — present in DB; optional on `User` until `prisma generate` matches the schema. */
type UserWithAdminRegistry = User & {
  authorities: string[]
  certificationExpiry: Date | null
  isActive: boolean
  deactivatedAt: Date | null
}

describe('User admin fields (M9-S4)', () => {
  const email = `m9-s4-test-${Date.now()}@example.com`
  let userId: string

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('Test123!', 10)
    const user = await prisma.user.create({
      data: {
        email,
        name: 'M9-S4 Integration User',
        role: 'SCO',
        passwordHash,
        disciplines: ['Building'],
        authorities: ['Safety Codes Council'],
        certificationExpiry: new Date('2027-01-15T00:00:00.000Z'),
        isActive: true,
        deactivatedAt: null,
      } as Prisma.UserCreateInput,
    })
    userId = user.id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('persists and reads M9-S4 columns', async () => {
    const row = (await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    })) as UserWithAdminRegistry
    expect(row.disciplines).toContain('Building')
    expect(row.authorities).toEqual(['Safety Codes Council'])
    expect(row.certificationExpiry?.toISOString()).toContain('2027-01-15')
    expect(row.isActive).toBe(true)
    expect(row.deactivatedAt).toBeNull()
  })

  it('supports deactivation fields', async () => {
    const deactivated = new Date('2026-05-01T08:00:00.000Z')
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false, deactivatedAt: deactivated } as Prisma.UserUpdateInput,
    })
    const row = (await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    })) as UserWithAdminRegistry
    expect(row.isActive).toBe(false)
    expect(row.deactivatedAt?.toISOString()).toBe(deactivated.toISOString())
  })
})
