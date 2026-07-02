export type PdfGenerationPhase =
  | 'loading-data'
  | 'fetching-photos'
  | 'preparing-images'
  | 'rendering-pdf'
  | 'complete'
  | 'failed'

export type PdfGenerationProgress = {
  phase: PdfGenerationPhase
  completed: number
  total: number
  message?: string
}

export type PdfGenerationProgressCallback = (progress: PdfGenerationProgress) => void

export function emitPdfProgress(
  onProgress: PdfGenerationProgressCallback | undefined,
  progress: PdfGenerationProgress,
): void {
  onProgress?.(progress)
}
