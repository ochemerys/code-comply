import { describe, it, expect, vi } from 'vitest'
import { PdfGenerationTimeoutError, runPdfGenerationWithTimeout } from './pdf-generation-runner.js'

describe('pdf-generation-runner (M11-S12)', () => {
  it('resolves when task completes before timeout', async () => {
    const result = await runPdfGenerationWithTimeout(async () => Buffer.from('%PDF-'), {
      timeoutMs: 500,
    })
    expect(result.toString()).toBe('%PDF-')
  })

  it('rejects with PdfGenerationTimeoutError when task exceeds timeout', async () => {
    await expect(
      runPdfGenerationWithTimeout(
        () =>
          new Promise<Buffer>((resolve) => {
            setTimeout(() => resolve(Buffer.from('%PDF-')), 200)
          }),
        { timeoutMs: 20 },
      ),
    ).rejects.toBeInstanceOf(PdfGenerationTimeoutError)
  })

  it('emits complete progress on success', async () => {
    const onProgress = vi.fn()
    await runPdfGenerationWithTimeout(async () => Buffer.from('x'), {
      timeoutMs: 500,
      onProgress,
    })
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'complete', completed: 1, total: 1 }),
    )
  })
})
