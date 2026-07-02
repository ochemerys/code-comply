import type { LoadTestTiming } from './load-test-metrics.js'

export type LoadTestTask<T> = (index: number) => Promise<T>

export interface RunConcurrentLoadOptions {
  concurrency: number
  /** Max in-flight tasks (defaults to concurrency). */
  maxInFlight?: number
}

/**
 * Run `count` tasks with bounded parallelism and record per-task timings.
 * Used by integration tests and k6-equivalent Node harnesses (M11-S13).
 */
export async function runConcurrentLoad<T>(
  count: number,
  task: LoadTestTask<T>,
  options: RunConcurrentLoadOptions,
): Promise<{ results: T[]; timings: LoadTestTiming[] }> {
  const maxInFlight = options.maxInFlight ?? options.concurrency
  const results: T[] = new Array(count)
  const timings: LoadTestTiming[] = new Array(count)

  let nextIndex = 0

  async function worker(): Promise<void> {
    let index = nextIndex++
    while (index < count) {
      const start = performance.now()
      try {
        results[index] = await task(index)
        timings[index] = { ok: true, durationMs: performance.now() - start }
      } catch (error) {
        timings[index] = {
          ok: false,
          durationMs: performance.now() - start,
          error: error instanceof Error ? error.message : String(error),
        }
      }
      index = nextIndex++
    }
  }

  const workers = Math.min(maxInFlight, count)
  await Promise.all(Array.from({ length: workers }, () => worker()))

  return { results, timings }
}

/** Wrap an HTTP-style call into a timing result. */
export async function runTimedRequest(
  fn: () => Promise<Response>,
): Promise<LoadTestTiming & { response?: Response }> {
  const start = performance.now()
  try {
    const response = await fn()
    const durationMs = performance.now() - start
    const ok = response.ok
    return { ok, durationMs, status: response.status, response }
  } catch (error) {
    return {
      ok: false,
      durationMs: performance.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
