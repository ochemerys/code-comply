/**
 * M11-S17 — Integration coverage linking iPad profiles to inspector capabilities.
 */
import { describe, it, expect } from 'vitest'
import {
  IPAD_ACCEPTANCE_CRITERIA,
  IPAD_DEVICE_PROFILES,
  IPAD_TEST_SCENARIOS,
  coversAllAcceptanceCriteria,
  coversAllTestScenarios,
} from '@/lib/device/ipad-device-config'
import {
  meetsIPadAcceptanceCriteria,
  snapshotToAcceptanceCriteria,
} from '@/lib/device/device-capabilities'

describe('iPad device scenarios integration (M11-S17)', () => {
  it('maps each physical device profile to portrait viewport dimensions', () => {
    for (const profile of IPAD_DEVICE_PROFILES) {
      expect(profile.portrait.width).toBeGreaterThanOrEqual(768)
      expect(profile.portrait.height).toBeGreaterThan(profile.portrait.width)
      expect(profile.userAgentHint).toContain('iPad')
    }
  })

  it('acceptance criteria mapping covers all six story requirements when capabilities are present', () => {
    const snapshot = {
      pwaInstall: true,
      camera: true,
      gps: true,
      offlineMode: true,
      touchEvents: true,
      performanceAcceptable: true,
    }
    const mapped = snapshotToAcceptanceCriteria(snapshot)
    expect(coversAllAcceptanceCriteria(mapped)).toBe(true)
    expect(mapped).toEqual([...IPAD_ACCEPTANCE_CRITERIA])
    expect(meetsIPadAcceptanceCriteria(snapshot)).toBe(true)
  })

  it('test scenario list matches story technical_details', () => {
    expect(coversAllTestScenarios([...IPAD_TEST_SCENARIOS])).toBe(true)
    expect(IPAD_TEST_SCENARIOS).toContain('install-pwa')
    expect(IPAD_TEST_SCENARIOS).toContain('sync-data')
  })
})
