import type { CertificationDTO, UserDTO } from '@codecomply/validators'

function isCertificationExpired(cert: CertificationDTO, now = Date.now()): boolean {
  if (cert.status === 'REVOKED' || cert.status === 'EXPIRED') return true
  if (cert.expiryDate) {
    return new Date(cert.expiryDate).getTime() < now
  }
  return false
}

/**
 * True when the inspector has at least one non-expired certification (M-01).
 */
export function hasValidCertification(user: UserDTO | null | undefined, now = Date.now()): boolean {
  const certs = user?.certifications
  if (!certs?.length) return false
  return certs.some((cert) => !isCertificationExpired(cert, now))
}
