/** M-07 — configurable idle warn / hard logout thresholds (Vite env overrides). */
export interface IdleLogoutConfig {
  warnAfterMs: number
  logoutAfterMs: number
}

const DEFAULT_WARN_MS = 14 * 60 * 1000
const DEFAULT_LOGOUT_MS = 15 * 60 * 1000

function parseEnvMs(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

export function getIdleLogoutConfig(): IdleLogoutConfig {
  const warnAfterMs = parseEnvMs(import.meta.env.VITE_IDLE_WARN_MS, DEFAULT_WARN_MS)
  let logoutAfterMs = parseEnvMs(import.meta.env.VITE_IDLE_LOGOUT_MS, DEFAULT_LOGOUT_MS)
  if (logoutAfterMs <= warnAfterMs) {
    logoutAfterMs = DEFAULT_LOGOUT_MS
  }
  return { warnAfterMs, logoutAfterMs }
}
