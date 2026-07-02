import { PDF_GENERATION_TIMEOUT_MS } from './pdf-generation-config.js'
import { emitPdfProgress, type PdfGenerationProgressCallback } from './pdf-generation-progress.js'

export type PdfGenerationRunOptions = {
  onProgress?: PdfGenerationProgressCallback
  timeoutMs?: number
}

export class PdfGenerationTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`PDF generation timed out after ${timeoutMs}ms`)
    this.name = 'PdfGenerationTimeoutError'
  }
}

export async function runPdfGenerationWithTimeout<T>(
  task: (onProgress?: PdfGenerationProgressCallback) => Promise<T>,
  options?: PdfGenerationRunOptions,
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? PDF_GENERATION_TIMEOUT_MS
  const onProgress = options?.onProgress

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      task(onProgress).then((value) => {
        emitPdfProgress(onProgress, {
          phase: 'complete',
          completed: 1,
          total: 1,
          message: 'PDF ready',
        })
        return value
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new PdfGenerationTimeoutError(timeoutMs)), timeoutMs)
      }),
    ])
    return result
  } catch (err) {
    emitPdfProgress(onProgress, {
      phase: 'failed',
      completed: 0,
      total: 1,
      message: err instanceof Error ? err.message : 'PDF generation failed',
    })
    throw err
  } finally {
    if (timer) clearTimeout(timer)
  }
}
