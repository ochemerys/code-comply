import { describe, it, expect } from 'vitest'
import {
  percentile,
  summarizeLoadTest,
  captureMemoryProfile,
  topSlowest,
  type LoadTestTiming,
} from './load-test-metrics.js'

describe('load-test-metrics (M11-S13)', () => {
  it('computes p95 from sorted durations', () => {
    const sorted = [10, 20, 30, 40, 100]
    expect(percentile(sorted, 95)).toBeGreaterThan(80)
    expect(percentile(sorted, 50)).toBe(30)
  })

  it('summarizes success rate and failures', () => {
    const timings: LoadTestTiming[] = [
      { ok: true, durationMs: 50 },
      { ok: true, durationMs: 100 },
      { ok: false, durationMs: 200, status: 500, error: 'fail' },
    ]
    const summary = summarizeLoadTest(timings)
    expect(summary.total).toBe(3)
    expect(summary.successCount).toBe(2)
    expect(summary.successRate).toBeCloseTo(2 / 3)
    expect(summary.failures).toHaveLength(1)
    expect(summary.p95Ms).toBeGreaterThan(0)
  })

  it('captures heap growth between snapshots', () => {
    const profile = captureMemoryProfile(
      { heapUsed: 1_000, rss: 2_000 } as never,
      { heapUsed: 1_500, rss: 2_100 } as never,
    )
    expect(profile.heapGrowthBytes).toBe(500)
  })

  it('lists top slowest operations', () => {
    const timings: LoadTestTiming[] = [
      { ok: true, durationMs: 10 },
      { ok: true, durationMs: 300 },
      { ok: true, durationMs: 50 },
    ]
    const slow = topSlowest(timings, 2)
    expect(slow[0]?.durationMs).toBe(300)
    expect(slow[1]?.durationMs).toBe(50)
  })
})
