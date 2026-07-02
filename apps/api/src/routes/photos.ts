import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { PhotoDTOSchema } from '@codecomply/validators'
import { photoService, MAX_PHOTO_UPLOAD_BYTES } from '../services/photo.service.js'
import { PhotoMapper } from '../mappers/photo.mapper.js'

const app = new OpenAPIHono()

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const IdParamSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' }, example: 'photo-1' }),
})

function mapError(error: unknown): { status: number; body: { error: string; message?: string } } {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message.includes('not found')) {
    return { status: 404, body: { error: message } }
  }
  if (message.includes('Unauthorized')) {
    return { status: 403, body: { error: message } }
  }
  if (
    message.includes('is required') ||
    message.includes('already exists') ||
    message.includes('Invalid')
  ) {
    return { status: 400, body: { error: message } }
  }
  return { status: 500, body: { error: 'Internal error', message } }
}

/** Maximum metadata field size (10KB) to prevent DoS attacks */
const MAX_METADATA_BYTES = 10 * 1024

function parseMetadataField(raw: string | undefined): Record<string, unknown> {
  if (raw === undefined || raw.trim() === '') {
    return {}
  }

  // Limit metadata size to prevent DoS attacks
  if (raw.length > MAX_METADATA_BYTES) {
    throw new Error(`Metadata exceeds maximum size of ${MAX_METADATA_BYTES} bytes`)
  }

  try {
    const v = JSON.parse(raw) as unknown
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      throw new Error('Metadata must be a JSON object, not an array or primitive')
    }
    return { ...(v as Record<string, unknown>) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid metadata JSON'
    throw new Error(msg)
  }
}

const PhotoUploadBodySchema = z.object({
  file: z.any().openapi({ type: 'string', format: 'binary', description: 'Photo file (max 10MB)' }),
  clientId: z.string().openapi({ example: 'client-abc-123' }),
  inspectionId: z.string().openapi({ example: 'insp-456' }),
  deficiencyId: z.string().optional().openapi({ example: 'def-789' }),
  checklistItemId: z.string().optional(),
  metadata: z.string().optional().openapi({ example: '{"caption":"North wall"}' }),
  annotations: z.string().optional(),
})

const uploadRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Photos'],
  summary: 'Upload evidence photo',
  description:
    'Multipart upload: `file`, `clientId`, `inspectionId`; optional `deficiencyId`, `checklistItemId`, `metadata` (JSON string), `annotations`.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: PhotoUploadBodySchema,
          example: {
            clientId: 'client-abc-123',
            inspectionId: 'insp-456',
            metadata: '{"caption":"North wall"}',
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Photo updated (deduplicated by clientId)',
      content: { 'application/json': { schema: PhotoDTOSchema } },
    },
    201: {
      description: 'Photo created',
      content: { 'application/json': { schema: PhotoDTOSchema } },
    },
    400: {
      description: 'Invalid multipart body or missing fields',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Inspection not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    413: {
      description: 'Payload too large',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

async function handlePhotoUpload(c: Context) {
  const userId = c.get('userId')
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Check Content-Length header first to prevent DoS attacks
  const contentLength = c.req.header('Content-Length')
  if (contentLength && parseInt(contentLength, 10) > MAX_PHOTO_UPLOAD_BYTES) {
    return c.json(
      {
        error: 'Payload too large',
        message: `Maximum upload size is ${MAX_PHOTO_UPLOAD_BYTES} bytes`,
      },
      413,
    )
  }

  let body: Record<string, string | File | (string | File)[]>
  try {
    body = (await c.req.parseBody({ all: true })) as Record<
      string,
      string | File | (string | File)[]
    >
  } catch {
    return c.json({ error: 'Invalid multipart body' }, 400)
  }

  const rawFile = body['file']
  const file = Array.isArray(rawFile) ? rawFile[0] : rawFile
  if (!(file instanceof File)) {
    return c.json({ error: 'Expected multipart field "file" with a file' }, 400)
  }

  const clientId = String(body['clientId'] ?? '').trim()
  if (!clientId) {
    return c.json({ error: 'clientId is required' }, 400)
  }

  const inspectionId = String(body['inspectionId'] ?? '').trim()
  if (!inspectionId) {
    return c.json({ error: 'inspectionId is required' }, 400)
  }

  // Double-check file size after parsing (defense in depth)
  if (file.size > MAX_PHOTO_UPLOAD_BYTES) {
    return c.json(
      {
        error: 'Payload too large',
        message: `Maximum upload size is ${MAX_PHOTO_UPLOAD_BYTES} bytes`,
      },
      413,
    )
  }

  const deficiencyRaw = body['deficiencyId']
  const deficiencyId =
    typeof deficiencyRaw === 'string'
      ? deficiencyRaw.trim()
      : Array.isArray(deficiencyRaw) && typeof deficiencyRaw[0] === 'string'
        ? deficiencyRaw[0].trim()
        : undefined

  const checklistRaw = body['checklistItemId']
  const checklistItemId =
    typeof checklistRaw === 'string'
      ? checklistRaw.trim()
      : Array.isArray(checklistRaw) && typeof checklistRaw[0] === 'string'
        ? checklistRaw[0].trim()
        : undefined

  const metaRaw = body['metadata']
  const metaStr =
    typeof metaRaw === 'string'
      ? metaRaw
      : Array.isArray(metaRaw) && typeof metaRaw[0] === 'string'
        ? metaRaw[0]
        : undefined

  let metadata: Record<string, unknown>
  try {
    metadata = parseMetadataField(metaStr)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid metadata'
    return c.json({ error: msg }, 400)
  }

  const annRaw = body['annotations']
  const annotations =
    typeof annRaw === 'string'
      ? annRaw
      : Array.isArray(annRaw) && typeof annRaw[0] === 'string'
        ? annRaw[0]
        : undefined

  try {
    const result = await photoService.upload(
      file,
      {
        clientId,
        inspectionId,
        ...(deficiencyId ? { deficiencyId } : {}),
        ...(checklistItemId ? { checklistItemId } : {}),
        metadata,
        annotations,
      },
      userId,
    )
    const dto = PhotoMapper.toDTO(result.photo)
    PhotoDTOSchema.parse(dto)
    return c.json(dto, result.created ? 201 : 200)
  } catch (e: unknown) {
    const { status, body: errBody } = mapError(e)
    return c.json(errBody, status as 400 | 403 | 404 | 500)
  }
}

app.openapi(uploadRoute, handlePhotoUpload)

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Photos'],
  summary: 'Delete evidence photo',
  description:
    'Removes photo bytes from object storage and deletes metadata. Idempotent when the photo does not exist. Optional query parameter clientId resolves local-only ids.',
  request: { params: IdParamSchema },
  responses: {
    204: { description: 'Deleted or already absent' },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Inspection not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid('param')
  const clientId = c.req.query('clientId')
  const userId = c.get('userId')

  try {
    await photoService.deleteByLookup(id, clientId, userId)
    return c.body(null, 204) as any
  } catch (e: unknown) {
    const { status, body: errBody } = mapError(e)
    return c.json(errBody, status as 403 | 404 | 500) as any
  }
})

export default app
export { MAX_PHOTO_UPLOAD_BYTES }
