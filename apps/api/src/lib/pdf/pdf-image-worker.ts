/**
 * Off-main-thread image resize for PDF embedding (M11-S12).
 * Compiled to dist alongside the API; tests fall back to main-thread resize.
 */
import { parentPort } from 'node:worker_threads'
import sharp from 'sharp'

type WorkerTask = {
  buffer: Buffer
  maxEdge: number
  quality: number
}

parentPort?.on('message', (task: WorkerTask) => {
  void (async () => {
    try {
      const out = await sharp(task.buffer)
        .rotate()
        .resize(task.maxEdge, task.maxEdge, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: task.quality, mozjpeg: true })
        .toBuffer()
      parentPort?.postMessage({ ok: true as const, buffer: out })
    } catch (err: unknown) {
      parentPort?.postMessage({
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })()
})
