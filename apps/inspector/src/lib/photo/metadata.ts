import type { PhotoMetadata } from '@/lib/db/types'

export interface GpsCoords {
  latitude: number
  longitude: number
  accuracy?: number
}

export interface BuildPhotoMetadataInput {
  capturedAt?: Date
  gps?: GpsCoords | null
  inspectorId: string
  inspectorName: string
  permitNumber?: string
  /** When omitted, uses {@link getDefaultDeviceInfo} */
  deviceInfo?: string
}

export interface EmbeddedPhotoMetadata {
  /** ISO 8601 capture time */
  timestamp: string
  gps: GpsCoords | null
  inspectorId: string
  inspectorName: string
  permitNumber?: string
  deviceInfo: string
}

export function getDefaultDeviceInfo(): string {
  if (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string') {
    return navigator.userAgent
  }
  return ''
}

export function buildEmbeddedPhotoMetadata(input: BuildPhotoMetadataInput): EmbeddedPhotoMetadata {
  const captured = input.capturedAt ?? new Date()
  return {
    timestamp: captured.toISOString(),
    gps: input.gps ?? null,
    inspectorId: input.inspectorId,
    inspectorName: input.inspectorName,
    permitNumber: input.permitNumber,
    deviceInfo: input.deviceInfo ?? getDefaultDeviceInfo(),
  }
}

export function toPhotoMetadata(
  embedded: EmbeddedPhotoMetadata,
  options: { hasWatermark: boolean },
): PhotoMetadata {
  const meta: PhotoMetadata = {
    timestamp: embedded.timestamp,
    inspectorId: embedded.inspectorId,
    hasWatermark: options.hasWatermark,
  }
  if (embedded.gps) {
    meta.latitude = embedded.gps.latitude
    meta.longitude = embedded.gps.longitude
    if (embedded.gps.accuracy !== undefined) {
      meta.accuracyMeters = embedded.gps.accuracy
    }
  }
  if (embedded.permitNumber !== undefined) meta.permitNumber = embedded.permitNumber
  if (embedded.inspectorName) meta.inspectorName = embedded.inspectorName
  if (embedded.deviceInfo) meta.deviceInfo = embedded.deviceInfo
  return meta
}

export interface WatermarkOptions {
  enabled: boolean
  /** Story default: bottom-right */
  position?: 'bottom-right'
}

/** Visible watermark: timestamp and inspector name; permit when present */
export function watermarkLines(embedded: EmbeddedPhotoMetadata): string[] {
  const lines = [embedded.timestamp, embedded.inspectorName]
  if (embedded.permitNumber) lines.push(embedded.permitNumber)
  return lines
}

const WATERMARK_PAD = 12
const WATERMARK_FONT = '14px system-ui, sans-serif'

export function drawWatermarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  embedded: EmbeddedPhotoMetadata,
): void {
  const lines = watermarkLines(embedded)
  ctx.save()
  ctx.font = WATERMARK_FONT
  const widths = lines.map((l) => ctx.measureText(l).width)
  const textW = widths.length ? Math.max(...widths) : 0
  const lineHeight = 18
  const boxW = textW + WATERMARK_PAD * 2
  const boxH = lines.length * lineHeight + WATERMARK_PAD * 2
  const x = canvasWidth - boxW - WATERMARK_PAD
  const y = canvasHeight - boxH - WATERMARK_PAD
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(x, y, boxW, boxH)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  lines.forEach((line, i) => {
    ctx.fillText(line, x + WATERMARK_PAD, y + WATERMARK_PAD + (i + 1) * lineHeight - 4)
  })
  ctx.restore()
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) reject(new Error('Failed to encode photo'))
        else resolve(b)
      },
      'image/jpeg',
      0.92,
    )
  })
}

async function renderToJpegFromSource(
  source: CanvasImageSource,
  width: number,
  height: number,
  embedded: EmbeddedPhotoMetadata,
  watermark: WatermarkOptions,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context is not available')
  ctx.drawImage(source, 0, 0, width, height)
  if (watermark.enabled) {
    drawWatermarkOnCanvas(ctx, width, height, embedded)
  }
  return canvasToJpeg(canvas)
}

function loadImageFromBlobViaHtmlImage(imageBlob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(imageBlob)
    const img = new Image()
    img.onload = (): void => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (): void => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

/**
 * Returns a new JPEG blob with optional bottom-right watermark (timestamp, inspector, permit).
 * Structured fields for storage should still be saved via {@link toPhotoMetadata}.
 */
export async function embedPhotoMetadataInImage(
  imageBlob: Blob,
  embedded: EmbeddedPhotoMetadata,
  watermark: WatermarkOptions,
): Promise<Blob> {
  if (!imageBlob.type.startsWith('image/')) {
    throw new Error('Blob must be an image')
  }

  let bitmap: ImageBitmap | null = null
  if (typeof createImageBitmap === 'function') {
    try {
      bitmap = await createImageBitmap(imageBlob)
    } catch {
      bitmap = null
    }
  }

  if (bitmap) {
    try {
      return await renderToJpegFromSource(bitmap, bitmap.width, bitmap.height, embedded, watermark)
    } finally {
      bitmap.close()
    }
  }

  const img = await loadImageFromBlobViaHtmlImage(imageBlob)
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) throw new Error('Image dimensions are not available')
  return renderToJpegFromSource(img, w, h, embedded, watermark)
}
