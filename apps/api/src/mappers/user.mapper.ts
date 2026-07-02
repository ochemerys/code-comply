import type { User } from '@codecomply/db'
import type { UserDTO, CertificationDTO } from '@codecomply/validators'

/** Public user fields used by UserMapper — excludes secrets (M11-S11). */
export type UserMapperInput = Pick<
  User,
  | 'id'
  | 'email'
  | 'name'
  | 'role'
  | 'designationId'
  | 'disciplines'
  | 'certifications'
  | 'lastLoginAt'
  | 'createdAt'
  | 'updatedAt'
> & {
  certificationExpiry?: Date | null
  authorities?: string[] | null
  isActive?: boolean
  deactivatedAt?: Date | null
}

export class UserMapper {
  /**
   * Map User entity to UserDTO (public profile)
   */
  static toDTO(user: UserMapperInput): UserDTO {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      designationId: user.designationId || undefined,
      disciplines: user.disciplines,
      certifications: user.certifications ? (user.certifications as CertificationDTO[]) : undefined,
      lastLoginAt: user.lastLoginAt?.toISOString(),
      certificationExpiry: user.certificationExpiry?.toISOString(),
      authorities: user.authorities ?? [],
      isActive: user.isActive,
      deactivatedAt: user.deactivatedAt?.toISOString(),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }
  }
}
