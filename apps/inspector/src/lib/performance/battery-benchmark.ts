/**
 * NFR-M-02 battery target for inspector field use (M11-S13).
 * Physical 8-hour drain tests run on devices; CI asserts this constant.
 */
export const INSPECTOR_BATTERY_TARGET_HOURS = 8

/** Estimated active inspection hours from a full charge at typical duty cycle. */
export function estimateBatteryLifeHours(params: {
  startPercent: number
  endPercent: number
  elapsedHours: number
}): number {
  const { startPercent, endPercent, elapsedHours } = params
  const drained = Math.max(0, startPercent - endPercent)
  if (drained <= 0 || elapsedHours <= 0) return Infinity
  return (100 / drained) * elapsedHours
}

export function meetsBatteryTarget(estimatedHours: number): boolean {
  return estimatedHours >= INSPECTOR_BATTERY_TARGET_HOURS
}
