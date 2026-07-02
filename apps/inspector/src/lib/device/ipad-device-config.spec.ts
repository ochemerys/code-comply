import { describe, it, expect } from 'vitest'
import {
  IPAD_ACCEPTANCE_CRITERIA,
  IPAD_DEVICE_PROFILES,
  IPAD_MIN_TOUCH_TARGET_PX,
  IPAD_PERFORMANCE_LOAD_MS,
  IPAD_TEST_SCENARIOS,
  coversAllAcceptanceCriteria,
  coversAllTestScenarios,
  getIPadProfile,
  listIPadProfiles,
} from './ipad-device-config'

describe('ipad-device-config (M11-S17)', () => {
  it('defines all three physical iPad targets from the story', () => {
    const labels = IPAD_DEVICE_PROFILES.map((p) => p.label)
    expect(labels).toContain('iPad Pro 12.9"')
    expect(labels).toContain('iPad Air')
    expect(labels).toContain('iPad mini')
    expect(IPAD_DEVICE_PROFILES).toHaveLength(3)
  })

  it('getIPadProfile returns portrait and landscape viewports', () => {
    const pro = getIPadProfile('ipad-pro-12-9')
    expect(pro.portrait).toEqual({ width: 1024, height: 1366 })
    expect(pro.landscape).toEqual({ width: 1366, height: 1024 })
  })

  it('throws for unknown profile id', () => {
    expect(() => getIPadProfile('unknown' as 'ipad-air')).toThrow('Unknown iPad profile')
  })

  it('listIPadProfiles returns a mutable copy', () => {
    const list = listIPadProfiles()
    expect(list).toHaveLength(3)
    list.pop()
    expect(listIPadProfiles()).toHaveLength(3)
  })

  it('covers all M11-S17 test scenarios', () => {
    expect(IPAD_TEST_SCENARIOS).toEqual([
      'install-pwa',
      'complete-inspection',
      'capture-photos',
      'work-offline',
      'sync-data',
    ])
    expect(coversAllTestScenarios([...IPAD_TEST_SCENARIOS])).toBe(true)
    expect(coversAllTestScenarios(['install-pwa'])).toBe(false)
  })

  it('covers all M11-S17 acceptance criteria', () => {
    expect(IPAD_ACCEPTANCE_CRITERIA).toHaveLength(6)
    expect(coversAllAcceptanceCriteria([...IPAD_ACCEPTANCE_CRITERIA])).toBe(true)
  })

  it('exposes performance and touch targets aligned with NFR-M-02', () => {
    expect(IPAD_PERFORMANCE_LOAD_MS).toBe(3000)
    expect(IPAD_MIN_TOUCH_TARGET_PX).toBeGreaterThanOrEqual(44)
  })
})
