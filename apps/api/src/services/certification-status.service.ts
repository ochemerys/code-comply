import type { User } from '@codecomply/db'
import type { CertificationDTO, CertificationStatusDTO } from '@codecomply/validators'

function parseCertifications(user: User): CertificationDTO[] {
  if (!user.certifications || !Array.isArray(user.certifications)) {
    return []
  }
  return user.certifications as CertificationDTO[]
}

export class CertificationStatusService {
  /**
   * Returns whether the inspector must re-authenticate due to revoked authority.
   */
  getStatus(user: User): CertificationStatusDTO {
    if (user.isActive === false) {
      return {
        revoked: true,
        revokedAt: user.deactivatedAt?.toISOString(),
        reasonCode: 'USER_DEACTIVATED',
      }
    }

    const revokedCert = parseCertifications(user).find((c) => c.status === 'REVOKED')
    if (revokedCert) {
      return {
        revoked: true,
        revokedAt: revokedCert.expiryDate ?? revokedCert.issuedDate,
        reasonCode: 'CERTIFICATION_REVOKED',
      }
    }

    return { revoked: false }
  }
}

export const certificationStatusService = new CertificationStatusService()
