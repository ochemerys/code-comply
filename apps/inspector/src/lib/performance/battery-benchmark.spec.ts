import { describe, it, expect } from 'vitest'
import {
  INSPECTOR_BATTERY_TARGET_HOURS,
  estimateBatteryLifeHours,
  meetsBatteryTarget,
} from './battery-benchmark.js'

describe('battery-benchmark (M11-S13)', () => {
  it('defines 8-hour battery life target', () => {
    expect(INSPECTOR_BATTERY_TARGET_HOURS).toBe(8)
  })

  it('estimates life from drain over elapsed time', () => {
    const hours = estimateBatteryLifeHours({
      startPercent: 100,
      endPercent: 75,
      elapsedHours: 2,
    })
    expect(hours).toBe(8)
    expect(meetsBatteryTarget(hours)).toBe(true)
  })

  it('fails target when drain is too fast', () => {
    const hours = estimateBatteryLifeHours({
      startPercent: 100,
      endPercent: 40,
      elapsedHours: 4,
    })
    expect(hours).toBeLessThan(INSPECTOR_BATTERY_TARGET_HOURS)
    expect(meetsBatteryTarget(hours)).toBe(false)
  })
})
