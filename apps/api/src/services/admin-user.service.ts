import type { Prisma, UserRole } from '@codecomply/db'
import { prisma } from '@codecomply/db'
import type { AdminCreateUserBody, CertificationDTO } from '@codecomply/validators'
import * as bcrypt from 'bcrypt'
import crypto from 'node:crypto'

/** Fields returned for admin list views — excludes passwordHash (M11-S11). */
const ADMIN_USER_LIST_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  designationId: true,
  disciplines: true,
  certifications: true,
  lastLoginAt: true,
  certificationExpiry: true,
  authorities: true,
  isActive: true,
  deactivatedAt: true,
  createdAt: true,
  updatedAt: true,
} as const

type AdminUserView = Prisma.UserGetPayload<{ select: typeof ADMIN_USER_LIST_SELECT }>

export type AdminUserListFilters = {
  role?: UserRole
  isActive?: boolean
  /** Case-insensitive match on email or name */
  search?: string
  page?: number
  pageSize?: number
}

export type AdminUpdateUserInput = {
  name?: string
  designationId?: string | null
  disciplines?: string[]
  authorities?: string[]
  certificationExpiry?: Date | null
}

export type AdminCreateUserInput = AdminCreateUserBody

export type AdminCreateUserResult = {
  user: AdminUserView
  temporaryPassword?: string
}

function generateTemporaryPassword(): string {
  return crypto.randomBytes(12).toString('base64url')
}

/** `UserWhereInput` may omit `isActive` until `prisma generate` matches the schema. */
type UserListWhere = Prisma.UserWhereInput & { isActive?: boolean }

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

export class AdminUserService {
  async list(filters: AdminUserListFilters = {}): Promise<AdminUserView[]> {
    const where: UserListWhere = {}

    if (filters.role !== undefined) {
      where.role = filters.role
    }
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive
    }
    if (filters.search?.trim()) {
      const q = filters.search.trim()
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ]
    }

    const pageSize = Math.min(Math.max(filters.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)
    const page = Math.max(filters.page ?? 1, 1)

    return prisma.user.findMany({
      where: where as Prisma.UserWhereInput,
      select: ADMIN_USER_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    })
  }

  async getById(id: string): Promise<AdminUserView | null> {
    return prisma.user.findUnique({
      where: { id },
      select: ADMIN_USER_LIST_SELECT,
    })
  }

  async create(data: AdminCreateUserInput): Promise<AdminCreateUserResult> {
    const existing = await prisma.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
      select: { id: true },
    })
    if (existing) {
      throw new Error('Email already registered')
    }

    if (data.role === 'OWNER') {
      throw new Error('Owner accounts cannot be created from the admin portal')
    }

    const temporaryPassword = data.initialPassword ?? generateTemporaryPassword()
    const passwordHash = await bcrypt.hash(temporaryPassword, 10)

    const user = await prisma.user.create({
      data: {
        email: data.email.trim().toLowerCase(),
        name: data.name.trim(),
        role: data.role,
        passwordHash,
        designationId: data.designationId?.trim() || null,
        disciplines: data.disciplines ?? [],
        authorities: data.authorities ?? [],
        certificationExpiry: data.certificationExpiry ? new Date(data.certificationExpiry) : null,
        certifications: (data.certifications ?? []) as unknown as Prisma.InputJsonValue,
        isActive: true,
      } as Prisma.UserCreateInput,
      select: ADMIN_USER_LIST_SELECT,
    })

    return {
      user,
      temporaryPassword: data.initialPassword ? undefined : temporaryPassword,
    }
  }

  async update(id: string, data: AdminUpdateUserInput): Promise<AdminUserView> {
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      throw new Error('User not found')
    }

    return prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.designationId !== undefined && { designationId: data.designationId }),
        ...(data.disciplines !== undefined && { disciplines: data.disciplines }),
        ...(data.authorities !== undefined && { authorities: data.authorities }),
        ...(data.certificationExpiry !== undefined && {
          certificationExpiry: data.certificationExpiry,
        }),
      },
      select: ADMIN_USER_LIST_SELECT,
    })
  }

  async updateCertifications(
    id: string,
    certifications: CertificationDTO[],
  ): Promise<AdminUserView> {
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      throw new Error('User not found')
    }

    return prisma.user.update({
      where: { id },
      data: { certifications: certifications as unknown as Prisma.InputJsonValue },
      select: ADMIN_USER_LIST_SELECT,
    })
  }

  async deactivate(id: string): Promise<AdminUserView> {
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      throw new Error('User not found')
    }

    return prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
      } as Prisma.UserUpdateInput,
      select: ADMIN_USER_LIST_SELECT,
    })
  }

  async reactivate(id: string): Promise<AdminUserView> {
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      throw new Error('User not found')
    }

    return prisma.user.update({
      where: { id },
      data: {
        isActive: true,
        deactivatedAt: null,
      } as Prisma.UserUpdateInput,
      select: ADMIN_USER_LIST_SELECT,
    })
  }
}

export const adminUserService = new AdminUserService()
