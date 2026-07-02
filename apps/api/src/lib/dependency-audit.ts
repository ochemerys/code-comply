import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type DependencySeverity = 'critical' | 'high' | 'moderate' | 'low' | 'info'

export interface DependencyVulnerability {
  name: string
  severity: DependencySeverity
  title: string
  url?: string
}

export interface DependencyAuditResult {
  passed: boolean
  scannedAt: string
  criticalCount: number
  highCount: number
  moderateCount: number
  vulnerabilities: DependencyVulnerability[]
  error?: string
}

/** pnpm audit --json output shape (subset). */
interface PnpmAuditJson {
  advisories?: Record<
    string,
    {
      severity?: string
      title?: string
      url?: string
      module_name?: string
    }
  >
  metadata?: {
    vulnerabilities?: {
      critical?: number
      high?: number
      moderate?: number
      low?: number
      info?: number
    }
  }
}

function normalizeSeverity(raw?: string): DependencySeverity {
  const value = raw?.toLowerCase() ?? 'info'
  if (value === 'critical' || value === 'high' || value === 'moderate' || value === 'low') {
    return value
  }
  return 'info'
}

/** Parse `pnpm audit --json` output into a structured result (M11-S7). */
export function parsePnpmAuditOutput(stdout: string): DependencyAuditResult {
  const scannedAt = new Date().toISOString()
  let parsed: PnpmAuditJson
  try {
    parsed = JSON.parse(stdout) as PnpmAuditJson
  } catch {
    return {
      passed: false,
      scannedAt,
      criticalCount: 0,
      highCount: 0,
      moderateCount: 0,
      vulnerabilities: [],
      error: 'Failed to parse pnpm audit JSON output',
    }
  }

  const meta = parsed.metadata?.vulnerabilities
  const criticalCount = meta?.critical ?? 0
  const highCount = meta?.high ?? 0
  const moderateCount = meta?.moderate ?? 0

  const vulnerabilities: DependencyVulnerability[] = []
  for (const advisory of Object.values(parsed.advisories ?? {})) {
    vulnerabilities.push({
      name: advisory.module_name ?? 'unknown',
      severity: normalizeSeverity(advisory.severity),
      title: advisory.title ?? 'Security advisory',
      url: advisory.url,
    })
  }

  return {
    passed: criticalCount === 0 && highCount === 0,
    scannedAt,
    criticalCount,
    highCount,
    moderateCount,
    vulnerabilities,
  }
}

export interface RunDependencyAuditOptions {
  cwd?: string
  /** Injectable runner for tests. */
  runAudit?: (cwd: string) => Promise<string>
}

async function defaultRunAudit(cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('pnpm', ['audit', '--json'], {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
  })
  return stdout
}

/**
 * Run dependency vulnerability scan via pnpm audit (M11-S7, OWASP A06).
 * Passes when no critical or high severity advisories are reported.
 */
export async function runDependencyAudit(
  options: RunDependencyAuditOptions = {},
): Promise<DependencyAuditResult> {
  const cwd = options.cwd ?? process.cwd()
  const runAudit = options.runAudit ?? defaultRunAudit

  try {
    const stdout = await runAudit(cwd)
    return parsePnpmAuditOutput(stdout)
  } catch (error: unknown) {
    const err = error as { stdout?: string }
    if (typeof err.stdout === 'string' && err.stdout.length > 0) {
      return parsePnpmAuditOutput(err.stdout)
    }
    const message = error instanceof Error ? error.message : String(error)
    return {
      passed: false,
      scannedAt: new Date().toISOString(),
      criticalCount: 0,
      highCount: 0,
      moderateCount: 0,
      vulnerabilities: [],
      error: message,
    }
  }
}
