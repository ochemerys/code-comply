import { describe, it, expect } from 'vitest'
import { runConcurrentLoad, runTimedRequest } from './load-test-runner.js'

describe('load-test-runner (M11-S13)', () => {
  it('runs tasks with bounded concurrency and records timings', async () => {
    let peakInFlight = 0
    let inFlight = 0

    const { results, timings } = await runConcurrentLoad(
      12,
      async () => {
        inFlight++
        peakInFlight = Math.max(peakInFlight, inFlight)
        await new Promise((r) => setTimeout(r, 5))
        inFlight--
        return 'ok'
      },
      { concurrency: 4 },
    )

    expect(results).toHaveLength(12)
    expect(timings.every((t) => t.ok)).toBe(true)
    expect(peakInFlight).toBeLessThanOrEqual(4)
  })

  it('records failures without aborting the batch', async () => {
    const { timings } = await runConcurrentLoad(
      3,
      async (index) => {
        if (index === 1) throw new Error('boom')
        return index
      },
      { concurrency: 3 },
    )

    expect(timings.filter((t) => t.ok)).toHaveLength(2)
    expect(timings.find((t) => !t.ok)?.error).toBe('boom')
  })

  it('runTimedRequest records HTTP success and failure', async () => {
    const ok = await runTimedRequest(async () => new Response('ok', { status: 200 }))
    expect(ok.ok).toBe(true)
    expect(ok.status).toBe(200)

    const bad = await runTimedRequest(async () => new Response('nope', { status: 503 }))
    expect(bad.ok).toBe(false)
    expect(bad.status).toBe(503)

    const err = await runTimedRequest(async () => {
      throw new Error('network')
    })
    expect(err.ok).toBe(false)
    expect(err.error).toBe('network')
  })
})
