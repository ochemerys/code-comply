import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { DocumentSignedUrlResponseSchema, DocumentDTOSchema } from '@codecomply/validators'
import { documentService, DOCUMENT_SIGNED_URL_TTL_SECONDS } from '../services/document.service.js'
import { inspectionService } from '../services/inspection.service.js'
import { DocumentMapper } from '../mappers/document.mapper.js'

/** M7-S9: multipart uploads max body size (10MB). */
export const MAX_DOCUMENT_UPLOAD_BYTES = 10 * 1024 * 1024

const app = new OpenAPIHono()

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const IdParamSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' }, example: 'doc-1' }),
})

function mapError(error: unknown): { status: number; body: { error: string; message?: string } } {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message.includes('not found')) {
    return { status: 404, body: { error: message } }
  }
  if (message.includes('Unauthorized')) {
    return { status: 403, body: { error: message } }
  }
  if (message.includes('inspectionId is required')) {
    return { status: 400, body: { error: message } }
  }
  return { status: 500, body: { error: 'Internal error', message } }
}

function optionalFormString(v: string | File | (string | File)[] | undefined): string | undefined {
  if (v === undefined) return undefined
  const s = Array.isArray(v) ? v[0] : v
  if (typeof s !== 'string') return undefined
  const t = s.trim()
  return t.length > 0 ? t : undefined
}

const DocumentUploadBodySchema = z.object({
  file: z
    .any()
    .openapi({ type: 'string', format: 'binary', description: 'Document file (max 10MB)' }),
  inspectionId: z.string().openapi({ example: 'insp-123' }),
  title: z.string().optional().openapi({ example: 'Site plan' }),
  description: z.string().optional().openapi({ example: 'Approved floor plan PDF' }),
  category: z.string().optional().openapi({ example: 'PLAN' }),
})

const uploadRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Documents'],
  summary: 'Upload inspection document',
  description:
    'Multipart upload: `file` (required), `inspectionId` (required), optional `title`, `description`, `category`.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: DocumentUploadBodySchema,
          example: {
            inspectionId: 'insp-123',
            title: 'Site plan',
            category: 'PLAN',
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Document uploaded',
      content: { 'application/json': { schema: DocumentDTOSchema } },
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

async function handleDocumentUpload(c: Context) {
  const userId = c.get('userId')
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

  const inspectionId = String(body['inspectionId'] ?? '').trim()
  if (!inspectionId) {
    return c.json({ error: 'inspectionId is required' }, 400)
  }

  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    return c.json(
      {
        error: 'Payload too large',
        message: `Maximum upload size is ${MAX_DOCUMENT_UPLOAD_BYTES} bytes`,
      },
      413,
    )
  }

  try {
    const inspection = await inspectionService.getById(inspectionId, userId)
    if (!inspection) {
      return c.json({ error: 'Inspection not found' }, 404)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('Unauthorized')) {
      return c.json({ error: msg }, 403)
    }
    throw e
  }

  const title = optionalFormString(body['title'])
  const description = optionalFormString(body['description'])
  const category = optionalFormString(body['category'])

  try {
    const doc = await documentService.upload(file, {
      inspectionId,
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
    })
    return c.json(DocumentMapper.toDTO(doc), 201)
  } catch (e: unknown) {
    const { status, body: errBody } = mapError(e)
    return c.json(errBody, status as 400 | 403 | 404 | 500)
  }
}

app.openapi(uploadRoute, handleDocumentUpload)

const signedUrlRoute = createRoute({
  method: 'get',
  path: '/{id}/url',
  tags: ['Documents'],
  summary: 'Get signed download URL',
  description:
    'Returns a time-limited signed URL to download the document bytes from object storage.',
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Signed URL',
      content: { 'application/json': { schema: DocumentSignedUrlResponseSchema } },
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
      description: 'Document not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app.openapi(signedUrlRoute, async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('userId')

  try {
    const doc = await documentService.getById(id)
    if (!doc) {
      return c.json({ error: 'Document not found' }, 404) as any
    }
    try {
      const inspection = await inspectionService.getById(doc.inspectionId, userId)
      if (!inspection) {
        return c.json({ error: 'Inspection not found' }, 404) as any
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('Unauthorized')) {
        return c.json({ error: msg }, 403) as any
      }
      throw e
    }

    const url = await documentService.getSignedUrl(id)
    return c.json({ url, expiresIn: DOCUMENT_SIGNED_URL_TTL_SECONDS }) as any
  } catch (e: unknown) {
    const { status, body: errBody } = mapError(e)
    return c.json(errBody, status as 403 | 404 | 500) as any
  }
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Documents'],
  summary: 'Delete document',
  description: 'Removes the object from storage and deletes metadata.',
  request: { params: IdParamSchema },
  responses: {
    204: { description: 'Deleted' },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Document not found',
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
  const userId = c.get('userId')

  try {
    const doc = await documentService.getById(id)
    if (!doc) {
      return c.json({ error: 'Document not found' }, 404) as any
    }
    try {
      const inspection = await inspectionService.getById(doc.inspectionId, userId)
      if (!inspection) {
        return c.json({ error: 'Inspection not found' }, 404) as any
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('Unauthorized')) {
        return c.json({ error: msg }, 403) as any
      }
      throw e
    }

    await documentService.delete(id)
    return c.body(null, 204) as any
  } catch (e: unknown) {
    const { status, body: errBody } = mapError(e)
    if (status === 404) {
      return c.json(errBody, 404) as any
    }
    if (status === 403) {
      return c.json(errBody, 403) as any
    }
    return c.json(errBody, 500) as any
  }
})

export default app
