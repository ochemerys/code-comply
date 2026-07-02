import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import sharp from 'sharp'
import {
  PDF_EMBED_JPEG_QUALITY,
  PDF_EMBED_MAX_EDGE_PX,
  PDF_IMAGE_WORKER_POOL_SIZE,
  PDF_PHOTO_PROCESS_CONCURRENCY,
  PDF_SKIP_RESIZE_IF_BYTES_BELOW,
} from './pdf-generation-config.js'
import { emitPdfProgress, type PdfGenerationProgressCallback } from './pdf-generation-progress.js'

export type PhotoFetchInput = { id: string; storageKey: string | null }

async function resizeOnMainThread(
  buffer: Buffer,
  maxEdge: number,
  quality: number,
): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer()
}

function resolveWorkerScriptPath(): string | null {
  const jsPath = fileURLToPath(new URL('./pdf-image-worker.js', import.meta.url))
  if (existsSync(jsPath)) return jsPath
  return null
}

function shouldUsePdfImageWorkers(): boolean {
  if (process.env.PDF_IMAGE_WORKERS === '0') return false
  if (process.env.VITEST === 'true') return false
  return resolveWorkerScriptPath() != null
}

type WorkerResult = { ok: true; buffer: Buffer } | { ok: false; error: string }

class PdfImageWorkerPool {
  private readonly workers: Worker[] = []
  private readonly idle: Worker[] = []
  private readonly waiters: Array<(worker: Worker) => void> = []

  constructor(private readonly scriptPath: string) {
    for (let i = 0; i < PDF_IMAGE_WORKER_POOL_SIZE; i++) {
      const worker = new Worker(this.scriptPath)
      this.workers.push(worker)
      this.idle.push(worker)
    }
  }

  private acquire(): Promise<Worker> {
    const idle = this.idle.pop()
    if (idle) return Promise.resolve(idle)
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  private release(worker: Worker): void {
    const waiter = this.waiters.shift()
    if (waiter) waiter(worker)
    else this.idle.push(worker)
  }

  async resize(buffer: Buffer, maxEdge: number, quality: number): Promise<Buffer> {
    const worker = await this.acquire()
    try {
      return await new Promise<Buffer>((resolve, reject) => {
        const onMessage = (msg: WorkerResult) => {
          worker.off('message', onMessage)
          worker.off('error', onError)
          this.release(worker)
          if (msg.ok) resolve(Buffer.from(msg.buffer))
          else reject(new Error(msg.error))
        }
        const onError = (err: Error) => {
          worker.off('message', onMessage)
          worker.off('error', onError)
          this.release(worker)
          reject(err)
        }
        worker.on('message', onMessage)
        worker.on('error', onError)
        worker.postMessage({
          buffer,
          maxEdge,
          quality,
        } satisfies { buffer: Buffer; maxEdge: number; quality: number })
      })
    } catch (err) {
      this.release(worker)
      throw err
    }
  }

  async destroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.terminate()))
    this.workers.length = 0
    this.idle.length = 0
  }
}

let workerPool: PdfImageWorkerPool | null = null

function getWorkerPool(): PdfImageWorkerPool | null {
  if (!shouldUsePdfImageWorkers()) return null
  const scriptPath = resolveWorkerScriptPath()
  if (!scriptPath) return null
  if (!workerPool) workerPool = new PdfImageWorkerPool(scriptPath)
  return workerPool
}

/** @internal Test hook — terminates worker pool between cases. */
export async function resetPdfImageWorkerPoolForTests(): Promise<void> {
  if (workerPool) {
    await workerPool.destroy()
    workerPool = null
  }
}

export async function preparePhotoBufferForPdfEmbed(
  raw: Buffer,
  options?: { maxEdge?: number; quality?: number },
): Promise<Buffer> {
  const maxEdge = options?.maxEdge ?? PDF_EMBED_MAX_EDGE_PX
  const quality = options?.quality ?? PDF_EMBED_JPEG_QUALITY

  if (raw.length <= PDF_SKIP_RESIZE_IF_BYTES_BELOW) {
    try {
      const meta = await sharp(raw).metadata()
      const w = meta.width ?? 0
      const h = meta.height ?? 0
      if (w > 0 && h > 0 && Math.max(w, h) <= maxEdge) {
        return raw
      }
    } catch {
      return raw
    }
  }

  const pool = getWorkerPool()
  if (pool) {
    return pool.resize(raw, maxEdge, quality)
  }
  return resizeOnMainThread(raw, maxEdge, quality)
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

/**
 * Fetches and resizes photo buffers with bounded concurrency and optional progress.
 * Drops individual failures so large reports still complete (M11-S12).
 */
export async function preparePhotoBuffersForPdf(
  photos: PhotoFetchInput[],
  fetchBytes: (photo: PhotoFetchInput) => Promise<Buffer | null>,
  onProgress?: PdfGenerationProgressCallback,
): Promise<Buffer[]> {
  const eligible = photos.filter((p) => p.storageKey)
  const total = eligible.length
  const buffers: Buffer[] = []
  let completed = 0

  emitPdfProgress(onProgress, {
    phase: 'fetching-photos',
    completed: 0,
    total,
    message: 'Loading photo evidence',
  })

  for (const batch of chunk(eligible, PDF_PHOTO_PROCESS_CONCURRENCY)) {
    const batchBuffers = await Promise.all(
      batch.map(async (photo) => {
        try {
          const raw = await fetchBytes(photo)
          if (!raw) return null
          emitPdfProgress(onProgress, {
            phase: 'preparing-images',
            completed,
            total,
          })
          const prepared = await preparePhotoBufferForPdfEmbed(raw)
          completed += 1
          emitPdfProgress(onProgress, {
            phase: 'preparing-images',
            completed,
            total,
          })
          return prepared
        } catch {
          completed += 1
          emitPdfProgress(onProgress, {
            phase: 'preparing-images',
            completed,
            total,
          })
          return null
        }
      }),
    )
    for (const buf of batchBuffers) {
      if (buf) buffers.push(buf)
    }
  }

  return buffers
}
