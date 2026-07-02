export interface LoadTestTiming {
  ok: boolean
  durationMs: number
  status?: number
  error?: string
}

export interface LoadTestSummary {
  total: number
  successCount: number
  successRate: number
  durationsMs: number[]
  p50Ms: number
  p95Ms: number
  maxMs: number
  failures: Array<{ index: number; error?: string; status?: number }>
}

export interface MemoryProfileSnapshot {
  heapUsedBefore: number
  heapUsedAfter: number
  heapGrowthBytes: number
  rssBefore: number
  rssAfter: number
}

/** Compute percentile from sorted durations (linear interpolation). */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]!
  const rank = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(rank)
  const upper = Math.ceil(rank)
  const weight = rank - lower
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight
}

export function summarizeLoadTest(timings: LoadTestTiming[]): LoadTestSummary {
  const success = timings.filter((t) => t.ok)
  const durationsMs = success.map((t) => t.durationMs).sort((a, b) => a - b)
  const failures = timings
    .map((t, index) => ({ t, index }))
    .filter(({ t }) => !t.ok)
    .map(({ t, index }) => ({ index, error: t.error, status: t.status }))

  return {
    total: timings.length,
    successCount: success.length,
    successRate: timings.length === 0 ? 0 : success.length / timings.length,
    durationsMs,
    p50Ms: percentile(durationsMs, 50),
    p95Ms: percentile(durationsMs, 95),
    maxMs: durationsMs.length > 0 ? durationsMs[durationsMs.length - 1]! : 0,
    failures,
  }
}

export function captureMemoryProfile(
  before: NodeJS.MemoryUsage,
  after: NodeJS.MemoryUsage,
): MemoryProfileSnapshot {
  return {
    heapUsedBefore: before.heapUsed,
    heapUsedAfter: after.heapUsed,
    heapGrowthBytes: after.heapUsed - before.heapUsed,
    rssBefore: before.rss,
    rssAfter: after.rss,
  }
}

/** Identify slowest samples for bottleneck reporting. */
export function topSlowest(
  timings: LoadTestTiming[],
  limit = 5,
): Array<{ index: number; durationMs: number; error?: string }> {
  return timings
    .map((t, index) => ({ index, durationMs: t.durationMs, error: t.error }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, limit)
}
