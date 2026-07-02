/** Hard cap on embedded photos per report to avoid OOM on pathological inspections (M11-S12). */
export const PDF_MAX_PHOTOS_PER_REPORT = 100

/** Default generation timeout — large reports fail fast instead of hanging workers. */
export const PDF_GENERATION_TIMEOUT_MS = 30_000

/** Acceptance target for inspection reports with ~20 photos (M11-S12). */
export const PDF_GENERATION_TARGET_MS = 10_000

/** Longest edge for images embedded in PDF pages (smaller than capture 1920px). */
export const PDF_EMBED_MAX_EDGE_PX = 1200

/** JPEG quality for PDF embeds — readable defects with smaller buffers. */
export const PDF_EMBED_JPEG_QUALITY = 75

/** Parallel photo fetch + resize batch size. */
export const PDF_PHOTO_PROCESS_CONCURRENCY = 6

/** Skip resize when source is already small enough for PDFKit embed. */
export const PDF_SKIP_RESIZE_IF_BYTES_BELOW = 80_000

/** Worker pool size for off-main-thread image prep (M11-S12). */
export const PDF_IMAGE_WORKER_POOL_SIZE = 2
