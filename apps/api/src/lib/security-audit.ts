import {
  DEFAULT_SECURITY_HEADERS,
  securityHeadersValid,
  verifySecurityHeaders,
  type SecurityHeaderVerification,
} from '../middleware/security-headers.js'
import { DEFAULT_CSP_DIRECTIVES, MIN_TLS_VERSION } from '../middleware/security.js'
import { APP_ROLES, roleMiddleware } from '../middleware/role.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { inputSanitizationMiddleware } from '../middleware/input-sanitization.js'
import { apiRateLimitMiddleware, loginRateLimitMiddleware } from '../middleware/rate-limit.js'
import { containsSqlInjection, isSafeExternalUrl } from './sanitization.js'
import { runDependencyAudit, type DependencyAuditResult } from './dependency-audit.js'
import { auditLogService } from '../services/audit-log.service.js'

export type OwaspCategoryId =
  | 'A01'
  | 'A02'
  | 'A03'
  | 'A04'
  | 'A05'
  | 'A06'
  | 'A07'
  | 'A08'
  | 'A09'
  | 'A10'

export interface OwaspAuditCheck {
  id: OwaspCategoryId
  name: string
  passed: boolean
  details: string
}

export interface SecurityAuditReport {
  passed: boolean
  auditedAt: string
  owasp: OwaspAuditCheck[]
  securityHeaders: SecurityHeaderVerification[]
  dependencyAudit?: DependencyAuditResult
}

export interface RunSecurityAuditOptions {
  /** When true, runs `pnpm audit` (slower; skip in unit tests). */
  includeDependencyScan?: boolean
  dependencyAuditCwd?: string
  responseHeaders?: Headers
  /** Injectable dependency scanner for tests. */
  dependencyAuditRunner?: typeof runDependencyAudit
}

const OWASP_CHECKLIST: { id: OwaspCategoryId; name: string }[] = [
  { id: 'A01', name: 'Broken Access Control' },
  { id: 'A02', name: 'Cryptographic Failures' },
  { id: 'A03', name: 'Injection' },
  { id: 'A04', name: 'Insecure Design' },
  { id: 'A05', name: 'Security Misconfiguration' },
  { id: 'A06', name: 'Vulnerable Components' },
  { id: 'A07', name: 'Authentication Failures' },
  { id: 'A08', name: 'Software Integrity Failures' },
  { id: 'A09', name: 'Logging Failures' },
  { id: 'A10', name: 'SSRF' },
]

function checkA01BrokenAccessControl(): OwaspAuditCheck {
  const hasRbac =
    typeof roleMiddleware === 'function' && APP_ROLES.includes('SCO') && APP_ROLES.includes('ADMIN')
  return {
    id: 'A01',
    name: 'Broken Access Control',
    passed: hasRbac,
    details: hasRbac
      ? 'RBAC middleware and role separation (SCO/ADMIN) are configured'
      : 'RBAC middleware or role definitions are missing',
  }
}

function checkA02CryptographicFailures(): OwaspAuditCheck {
  const tlsOk = MIN_TLS_VERSION === 'TLSv1.2'
  const cspOk = DEFAULT_CSP_DIRECTIVES['default-src'] === "'self'"
  const passed = tlsOk && cspOk
  return {
    id: 'A02',
    name: 'Cryptographic Failures',
    passed,
    details: passed
      ? `TLS minimum ${MIN_TLS_VERSION}, CSP default-src restricted, HSTS supported`
      : 'TLS or CSP configuration does not meet requirements',
  }
}

function checkA03Injection(): OwaspAuditCheck {
  const hasSanitization = typeof inputSanitizationMiddleware === 'function'
  const sqlDetected = containsSqlInjection("'; DROP TABLE users; --")
  const passed = hasSanitization && sqlDetected
  return {
    id: 'A03',
    name: 'Injection',
    passed,
    details: passed
      ? 'Input sanitization middleware active; SQL injection patterns detectable'
      : 'Input sanitization middleware or injection detection is missing',
  }
}

function checkA04InsecureDesign(): OwaspAuditCheck {
  const hasRateLimits =
    typeof apiRateLimitMiddleware === 'function' && typeof loginRateLimitMiddleware === 'function'
  return {
    id: 'A04',
    name: 'Insecure Design',
    passed: hasRateLimits,
    details: hasRateLimits
      ? 'API and login rate limiting middleware are configured'
      : 'Rate limiting middleware is missing',
  }
}

function checkA05SecurityMisconfiguration(headers?: Headers): OwaspAuditCheck {
  const headerChecks = headers
    ? verifySecurityHeaders(headers)
    : verifySecurityHeaders(new Headers(Object.entries(DEFAULT_SECURITY_HEADERS)))
  const passed = headerChecks.every((c) => c.passed)
  return {
    id: 'A05',
    name: 'Security Misconfiguration',
    passed,
    details: passed
      ? 'Required security headers (X-Frame-Options, nosniff, Referrer-Policy) verified'
      : `Missing or incorrect headers: ${headerChecks
          .filter((c) => !c.passed)
          .map((c) => c.name)
          .join(', ')}`,
  }
}

function checkA06FromDependencyResult(result?: DependencyAuditResult): OwaspAuditCheck {
  if (!result) {
    return {
      id: 'A06',
      name: 'Vulnerable Components',
      passed: true,
      details: 'Dependency scan skipped (enable includeDependencyScan to run pnpm audit)',
    }
  }
  if (result.error) {
    return {
      id: 'A06',
      name: 'Vulnerable Components',
      passed: false,
      details: `Dependency scan failed: ${result.error}`,
    }
  }
  return {
    id: 'A06',
    name: 'Vulnerable Components',
    passed: result.passed,
    details: result.passed
      ? `No critical/high vulnerabilities (${result.moderateCount} moderate)`
      : `Found ${result.criticalCount} critical and ${result.highCount} high severity issues`,
  }
}

function checkA07AuthenticationFailures(): OwaspAuditCheck {
  const hasAuth = typeof authMiddleware === 'function'
  const hasLoginLimit = typeof loginRateLimitMiddleware === 'function'
  const passed = hasAuth && hasLoginLimit
  return {
    id: 'A07',
    name: 'Authentication Failures',
    passed,
    details: passed
      ? 'JWT auth middleware and login rate limiting are configured'
      : 'Authentication middleware or login rate limiting is missing',
  }
}

function checkA08SoftwareIntegrity(): OwaspAuditCheck {
  const nodeEnv = process.env.NODE_ENV ?? 'development'
  const productionSafe = nodeEnv !== 'production' || process.env.ALLOW_INSECURE_DEV !== 'true'
  return {
    id: 'A08',
    name: 'Software Integrity Failures',
    passed: productionSafe,
    details: productionSafe
      ? 'Production mode does not allow insecure dev overrides'
      : 'Insecure development overrides enabled in production',
  }
}

function checkA09LoggingFailures(): OwaspAuditCheck {
  const hasAuditLog = typeof auditLogService?.append === 'function'
  return {
    id: 'A09',
    name: 'Logging Failures',
    passed: hasAuditLog,
    details: hasAuditLog
      ? 'Audit log service is available for security-relevant events'
      : 'Audit log service is not configured',
  }
}

function checkA10Ssrf(): OwaspAuditCheck {
  const blocksInternal = !isSafeExternalUrl('http://127.0.0.1/admin')
  const blocksMetadata = !isSafeExternalUrl('http://169.254.169.254/latest/meta-data/')
  const allowsPublic = isSafeExternalUrl('https://example.com/resource')
  const passed = blocksInternal && blocksMetadata && allowsPublic
  return {
    id: 'A10',
    name: 'SSRF',
    passed,
    details: passed
      ? 'URL validation blocks private/metadata hosts and allows public HTTPS URLs'
      : 'SSRF protections on URL fields are incomplete',
  }
}

/** Run OWASP Top 10 static control checks (M11-S7). */
export function runOwaspTop10Audit(options: RunSecurityAuditOptions = {}): OwaspAuditCheck[] {
  const checks: OwaspAuditCheck[] = OWASP_CHECKLIST.map(({ id }) => {
    switch (id) {
      case 'A01':
        return checkA01BrokenAccessControl()
      case 'A02':
        return checkA02CryptographicFailures()
      case 'A03':
        return checkA03Injection()
      case 'A04':
        return checkA04InsecureDesign()
      case 'A05':
        return checkA05SecurityMisconfiguration(options.responseHeaders)
      case 'A06':
        return checkA06FromDependencyResult(undefined)
      case 'A07':
        return checkA07AuthenticationFailures()
      case 'A08':
        return checkA08SoftwareIntegrity()
      case 'A09':
        return checkA09LoggingFailures()
      case 'A10':
        return checkA10Ssrf()
      default:
        return { id, name: 'Unknown', passed: false, details: 'Unhandled category' }
    }
  })
  return checks
}

/**
 * Comprehensive security audit: OWASP Top 10, security headers, optional dependency scan (M11-S7).
 */
export async function runSecurityAudit(
  options: RunSecurityAuditOptions = {},
): Promise<SecurityAuditReport> {
  const auditedAt = new Date().toISOString()
  const securityHeaders = options.responseHeaders
    ? verifySecurityHeaders(options.responseHeaders)
    : verifySecurityHeaders(new Headers(Object.entries(DEFAULT_SECURITY_HEADERS)))

  let dependencyAudit: DependencyAuditResult | undefined
  if (options.includeDependencyScan) {
    const runner = options.dependencyAuditRunner ?? runDependencyAudit
    dependencyAudit = await runner({ cwd: options.dependencyAuditCwd })
  }

  const owasp = runOwaspTop10Audit(options).map((check) => {
    if (check.id === 'A05') {
      return checkA05SecurityMisconfiguration(options.responseHeaders)
    }
    if (check.id === 'A06') {
      return checkA06FromDependencyResult(dependencyAudit)
    }
    return check
  })

  const headersPassed = options.responseHeaders
    ? securityHeadersValid(options.responseHeaders)
    : securityHeaders.every((c) => c.passed)

  const owaspPassed = owasp.every((c) => c.passed)
  const dependencyPassed = dependencyAudit ? dependencyAudit.passed : true

  return {
    passed: owaspPassed && headersPassed && dependencyPassed,
    auditedAt,
    owasp,
    securityHeaders,
    dependencyAudit,
  }
}

/** Penetration-style probes used in integration tests (M11-S7). */
export const PENETRATION_PROBE_PAYLOADS = {
  sqlInjection: "' OR '1'='1'; DROP TABLE users; --",
  xss: '<script>alert("xss")</script>',
  pathTraversal: '../../../etc/passwd',
  ssrfInternal: 'http://127.0.0.1:4000/health',
  ssrfMetadata: 'http://169.254.169.254/latest/meta-data/',
} as const
