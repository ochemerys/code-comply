import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import {
  useInspectionTimer,
  formatElapsedMs,
  currentElapsedMs,
  inspectionTimerStorageKey,
  readInspectionTimerState,
  type InspectionTimerStateV1,
} from './useInspectionTimer'

describe('useInspectionTimer helpers', () => {
  it('formatElapsedMs pads to HH:MM:SS', () => {
    expect(formatElapsedMs(0)).toBe('00:00:00')
    expect(formatElapsedMs(61_000)).toBe('00:01:01')
    expect(formatElapsedMs(3_661_000)).toBe('01:01:01')
  })

  it('currentElapsedMs sums segment', () => {
    const s: InspectionTimerStateV1 = {
      v: 1,
      accumulatedMs: 1000,
      segmentStartedAt: Date.now() - 2000,
      completed: false,
    }
    expect(currentElapsedMs(s)).toBeGreaterThanOrEqual(2990)
    expect(currentElapsedMs(s)).toBeLessThanOrEqual(3010)
  })
})

describe('useInspectionTimer', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  function mountTimer(setup: () => void) {
    const C = defineComponent({
      setup() {
        setup()
        return () => null
      },
    })
    return mount(C)
  }

  it('starts when execution becomes ready and not completed', async () => {
    const inspectionId = ref('insp-a')
    const executionReady = ref(false)
    const executionCompletedAt = ref<string | undefined>(undefined)

    mountTimer(() => {
      useInspectionTimer({
        inspectionId,
        executionCompletedAt,
        executionReady,
      })
    })

    executionReady.value = true
    await flushPromises()
    await nextTick()

    const key = inspectionTimerStorageKey('insp-a')
    const raw = localStorage.getItem(key)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as InspectionTimerStateV1
    expect(parsed.completed).toBe(false)
    expect(typeof parsed.segmentStartedAt).toBe('number')
  })

  it('persists elapsed state across hydrate (restart simulation)', async () => {
    const inspectionId = ref('insp-b')
    const executionReady = ref(true)
    const executionCompletedAt = ref<string | undefined>(undefined)

    let api: ReturnType<typeof useInspectionTimer> | null = null

    const w1 = mountTimer(() => {
      api = useInspectionTimer({
        inspectionId,
        executionCompletedAt,
        executionReady,
      })
    })

    await flushPromises()
    vi.advanceTimersByTime(5000)
    await flushPromises()

    const key = inspectionTimerStorageKey('insp-b')
    const mid = JSON.parse(localStorage.getItem(key)!) as InspectionTimerStateV1
    expect(mid.accumulatedMs).toBeGreaterThan(0)

    w1.unmount()

    const w2 = mountTimer(() => {
      api = useInspectionTimer({
        inspectionId,
        executionCompletedAt,
        executionReady,
      })
    })

    await flushPromises()
    expect(api!.displayTime.value).not.toBe('00:00:00')

    w2.unmount()
  })

  it('stop() freezes timer and returns duration in seconds', async () => {
    const inspectionId = ref('insp-c')
    const executionReady = ref(true)
    const executionCompletedAt = ref<string | undefined>(undefined)

    let stopFn: (() => number) | null = null

    const w = mountTimer(() => {
      const { stop } = useInspectionTimer({
        inspectionId,
        executionCompletedAt,
        executionReady,
      })
      stopFn = stop
    })

    await flushPromises()
    vi.advanceTimersByTime(10_000)
    await flushPromises()

    const secs = stopFn!()
    expect(secs).toBeGreaterThanOrEqual(9)

    const st = readInspectionTimerState('insp-c')
    expect(st?.completed).toBe(true)
    expect(st?.finalDurationMs).toBeDefined()

    w.unmount()
  })

  it('respects executionCompletedAt with savedDurationSeconds when LS empty', async () => {
    const inspectionId = ref('insp-d')
    const executionReady = ref(true)
    const executionCompletedAt = ref('2026-01-01T12:00:00.000Z')
    const savedDurationSeconds = ref(125)

    let api: ReturnType<typeof useInspectionTimer> | null = null

    const w = mountTimer(() => {
      api = useInspectionTimer({
        inspectionId,
        executionCompletedAt,
        executionReady,
        savedDurationSeconds,
      })
    })

    await flushPromises()
    expect(api!.displayTime.value).toBe('00:02:05')
    expect(api!.isRunning.value).toBe(false)

    w.unmount()
  })
})
