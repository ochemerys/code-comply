/** Load-test targets from M11-S13 acceptance criteria. */

export const LOAD_TEST_SYNC_CONCURRENCY = 50

export const LOAD_TEST_PDF_CONCURRENCY = 10

export const LOAD_TEST_API_CONCURRENCY = 100

/** Minimum successful sync push ratio under concurrent load. */
export const LOAD_TEST_SYNC_SUCCESS_RATE = 0.99

/** API p95 response time target (ms) — aligns with M11-S11 / NFR. */
export const LOAD_TEST_API_P95_MS = 200

/** PDF generation p95 under concurrent load (ms) — aligns with M11-S12. */
export const LOAD_TEST_PDF_P95_MS = 10_000

/** Inspector battery life target in hours (physical device test; CI asserts constant). */
export const LOAD_TEST_BATTERY_LIFE_HOURS = 8

/** Max heap growth (bytes) allowed during a single load scenario snapshot. */
export const LOAD_TEST_MAX_HEAP_GROWTH_BYTES = 80 * 1024 * 1024
