/**
 * Inspection elapsed timer with localStorage persistence (M5-S17).
 * Format HH:MM:SS; keyed by inspection ID; survives app restarts while in progress.
 */

import { onUnmounted, ref, watch, toValue, type MaybeRefOrGetter, type Ref } from 'vue'

export const INSPECTION_TIMER_STORAGE_PREFIX = 'inspection-timer-'

export function inspectionTimerStorageKey(inspectionId: string): string {
  return `${INSPECTION_TIMER_STORAGE_PREFIX}${inspectionId}`
}

export interface InspectionTimerStateV1 {
  v: 1
  accumulatedMs: number
  segmentStartedAt: number | null
  completed: boolean
  completedAtIso?: string
  finalDurationMs?: number
}

export function formatElapsedMs(totalMs: number): string {
  const s = Math.max(0, Math.floor(totalMs / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':')
}

export function readInspectionTimerState(inspectionId: string): InspectionTimerStateV1 | null {
  if (!inspectionId) return null
  return loadState(inspectionTimerStorageKey(inspectionId))
}

function loadState(key: string): InspectionTimerStateV1 | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const p = JSON.parse(raw) as InspectionTimerStateV1
    if (p?.v !== 1) return null
    return p
  } catch {
    return null
  }
}

function saveState(key: string, s: InspectionTimerStateV1): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(s))
  } catch {
    // ignore quota / private mode
  }
}

export function currentElapsedMs(s: InspectionTimerStateV1): number {
  if (s.completed) return s.finalDurationMs ?? s.accumulatedMs
  let ms = s.accumulatedMs
  if (s.segmentStartedAt != null) ms += Date.now() - s.segmentStartedAt
  return ms
}

function rollSegment(s: InspectionTimerStateV1): void {
  if (s.completed || s.segmentStartedAt == null) return
  const now = Date.now()
  s.accumulatedMs += now - s.segmentStartedAt
  s.segmentStartedAt = now
}

export interface UseInspectionTimerOptions {
  inspectionId: MaybeRefOrGetter<string>
  /** Set when checklist execution payload includes completedAt */
  executionCompletedAt: MaybeRefOrGetter<string | undefined>
  /** True once execution aggregate is loaded (avoid starting before hydration) */
  executionReady: MaybeRefOrGetter<boolean>
  /** Fallback when execution is complete but timer LS empty (e.g. new device) */
  savedDurationSeconds?: MaybeRefOrGetter<number | undefined>
}

export interface UseInspectionTimerReturn {
  displayTime: Ref<string>
  isRunning: Ref<boolean>
  /** Elapsed ms (live while running, frozen when completed) */
  elapsedMs: Ref<number>
  /** Final duration in whole seconds after stop(); 0 if nothing to flush */
  stop: () => number
}

export function useInspectionTimer(options: UseInspectionTimerOptions): UseInspectionTimerReturn {
  const displayTime = ref('00:00:00')
  const running = ref(false)
  const elapsedMs = ref(0)

  let intervalId: ReturnType<typeof setInterval> | null = null

  const state = ref<InspectionTimerStateV1 | null>(null)

  function clearTick() {
    if (intervalId != null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  function refreshDisplay() {
    const s = state.value
    if (!s) {
      displayTime.value = '00:00:00'
      elapsedMs.value = 0
      return
    }
    const ms = currentElapsedMs(s)
    elapsedMs.value = ms
    displayTime.value = formatElapsedMs(ms)
  }

  function startTick() {
    clearTick()
    intervalId = setInterval(() => {
      const s = state.value
      const id = toValue(options.inspectionId)
      if (!s || !id || s.completed) return
      rollSegment(s)
      saveState(inspectionTimerStorageKey(id), s)
      refreshDisplay()
    }, 1000)
  }

  function hydrate() {
    const id = toValue(options.inspectionId)
    const ready = toValue(options.executionReady)
    if (!id || !ready) return

    const key = inspectionTimerStorageKey(id)
    const fromLs = loadState(key)
    const completed = Boolean(toValue(options.executionCompletedAt))
    const savedSec = toValue(options.savedDurationSeconds)

    clearTick()

    if (completed) {
      if (fromLs?.completed && fromLs.finalDurationMs != null) {
        state.value = { ...fromLs }
      } else if (savedSec != null && savedSec > 0) {
        const ms = savedSec * 1000
        state.value = {
          v: 1,
          accumulatedMs: ms,
          segmentStartedAt: null,
          completed: true,
          finalDurationMs: ms,
        }
      } else if (fromLs && !fromLs.completed) {
        rollSegment(fromLs)
        fromLs.completed = true
        fromLs.finalDurationMs = fromLs.accumulatedMs
        fromLs.segmentStartedAt = null
        fromLs.completedAtIso = new Date().toISOString()
        saveState(key, fromLs)
        state.value = fromLs
      } else {
        state.value = {
          v: 1,
          accumulatedMs: 0,
          segmentStartedAt: null,
          completed: true,
          finalDurationMs: 0,
        }
      }
      running.value = false
      refreshDisplay()
      return
    }

    if (fromLs?.completed) {
      state.value = { ...fromLs }
      running.value = false
      refreshDisplay()
      return
    }

    if (fromLs) {
      if (fromLs.segmentStartedAt == null) {
        fromLs.segmentStartedAt = Date.now()
      }
      state.value = fromLs
      saveState(key, fromLs)
      running.value = true
      refreshDisplay()
      startTick()
      return
    }

    const initial: InspectionTimerStateV1 = {
      v: 1,
      accumulatedMs: 0,
      segmentStartedAt: Date.now(),
      completed: false,
    }
    state.value = initial
    saveState(key, initial)
    running.value = true
    refreshDisplay()
    startTick()
  }

  watch(
    () => ({
      id: toValue(options.inspectionId),
      ready: toValue(options.executionReady),
      completed: toValue(options.executionCompletedAt),
      saved: toValue(options.savedDurationSeconds),
    }),
    hydrate,
    { immediate: true },
  )

  function stop(): number {
    const id = toValue(options.inspectionId)
    if (!id || !state.value) return 0
    const key = inspectionTimerStorageKey(id)
    const s = state.value
    if (s.completed) {
      return Math.round((s.finalDurationMs ?? s.accumulatedMs) / 1000)
    }
    rollSegment(s)
    s.completed = true
    s.finalDurationMs = s.accumulatedMs
    s.segmentStartedAt = null
    s.completedAtIso = new Date().toISOString()
    saveState(key, s)
    running.value = false
    clearTick()
    refreshDisplay()
    return Math.round((s.finalDurationMs ?? 0) / 1000)
  }

  onUnmounted(() => {
    clearTick()
  })

  return {
    displayTime,
    isRunning: running,
    elapsedMs,
    stop,
  }
}
