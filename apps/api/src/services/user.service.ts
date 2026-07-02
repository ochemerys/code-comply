import type { User } from '@codecomply/db'
import { prisma } from '@codecomply/db'
import type { CertificationDTO } from '@codecomply/validators'

export class UserService {
  /**
   * Get user by ID
   */
  async getById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    })
  }

  /**
   * Get user certifications
   */
  async getCertifications(userId: string): Promise<CertificationDTO[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { certifications: true },
    })

    if (!user || !user.certifications) {
      return []
    }

    return user.certifications as CertificationDTO[]
  }

  /**
   * Snapshot certification at time of inspection (for legal record)
   */
  async snapshotCertification(userId: string): Promise<object> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        designationId: true,
        disciplines: true,
        certifications: true,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    return {
      userId: user.id,
      name: user.name,
      designationId: user.designationId,
      disciplines: user.disciplines,
      certifications: user.certifications,
      snapshotAt: new Date().toISOString(),
    }
  }
}

export const userService = new UserService()
