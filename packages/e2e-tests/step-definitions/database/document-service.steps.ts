/**
 * M7-S8: DocumentService BDD steps (real DB + fake object storage).
 */
import { Given, When, Then, Before } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { inspectionDocumentDelegate, prisma } from '@codecomply/db'
import { DocumentService } from '../../../../apps/api/src/services/document.service.js'
import type { ObjectStorageClient } from '../../../../apps/api/src/lib/storage/storage-client.js'

interface Ctx {
  inspectionId?: string
  documentId?: string
  storageKey?: string
  puts?: Array<{ kind: string; key: string }>
  deletes?: string[]
  signedCalls?: number
}

const ctx: Ctx = { puts: [], deletes: [], signedCalls: 0 }

function buildService(): DocumentService {
  ctx.puts = []
  ctx.deletes = []
  ctx.signedCalls = 0
  const storage = {
    putObject: async (kind: 'photos' | 'documents', key: string) => {
      ctx.puts!.push({ kind, key })
    },
    deleteObject: async (kind: 'photos' | 'documents', key: string) => {
      ctx.deletes!.push(`${kind}:${key}`)
    },
    getSignedGetUrl: async (kind: 'photos' | 'documents', key: string, _exp: number) => {
      ctx.signedCalls = (ctx.signedCalls ?? 0) + 1
      return `https://e2e-signed.example/${kind}/${key}`
    },
  } as unknown as ObjectStorageClient
  return new DocumentService(storage)
}

let service: DocumentService

Before(function () {
  Object.keys(ctx).forEach((k) => delete ctx[k as keyof Ctx])
  ctx.puts = []
  ctx.deletes = []
  ctx.signedCalls = 0
  service = buildService()
})

Given('document service E2E data is prepared', async function () {
  await inspectionDocumentDelegate.deleteMany({
    where: { inspection: { notes: 'M7-E2E document service' } },
  })
  await prisma.permitInspection.deleteMany({
    where: { notes: 'M7-E2E document service' },
  })

  const inspection = await prisma.permitInspection.create({
    data: {
      scheduledDate: new Date('2026-10-01'),
      status: 'IN_PROGRESS',
      notes: 'M7-E2E document service',
    },
  })
  ctx.inspectionId = inspection.id
})

When('I upload a document via DocumentService', async function () {
  const file = new File([new TextEncoder().encode('e2e-doc-body')], 'notice.pdf', {
    type: 'application/pdf',
  })
  const doc = await service.upload(file, {
    inspectionId: ctx.inspectionId!,
    title: 'E2E notice',
    category: 'compliance',
  })
  ctx.documentId = doc.id
  ctx.storageKey = doc.storageKey
})

When('I request a signed URL via DocumentService', async function () {
  await service.getSignedUrl(ctx.documentId!)
})

When('I delete that document via DocumentService', async function () {
  await service.delete(ctx.documentId!)
})

When('I upload two documents via DocumentService', async function () {
  const one = new File([new Uint8Array([1])], 'one.txt', { type: 'text/plain' })
  const two = new File([new Uint8Array([2])], 'two.txt', { type: 'text/plain' })
  await service.upload(one, { inspectionId: ctx.inspectionId! })
  await service.upload(two, { inspectionId: ctx.inspectionId! })
})

Then('the inspection_documents row should match the upload', async function () {
  const row = await inspectionDocumentDelegate.findUniqueOrThrow({
    where: { id: ctx.documentId! },
  })
  expect(row.filename).toBe('notice.pdf')
  expect(row.mimeType).toBe('application/pdf')
  expect(row.metadata).toEqual({ title: 'E2E notice', category: 'compliance' })
  expect(row.storageKey).toBe(ctx.storageKey)
})

Then('the fake document storage should have recorded a put', function () {
  const docPuts = ctx.puts!.filter((p) => p.kind === 'documents')
  expect(docPuts.length).toBeGreaterThanOrEqual(1)
  expect(docPuts.some((p) => p.key === ctx.storageKey)).toBe(true)
})

Then('the fake document storage should have issued a presigned GET', function () {
  expect(ctx.signedCalls).toBeGreaterThanOrEqual(1)
})

Then('the document row should be gone', async function () {
  const row = await inspectionDocumentDelegate.findUnique({ where: { id: ctx.documentId! } })
  expect(row).toBeNull()
})

Then('the fake document storage should have recorded a delete', function () {
  expect(ctx.deletes!.some((d) => d === `documents:${ctx.storageKey}`)).toBe(true)
})

Then('DocumentService getByInspection should return at least two rows', async function () {
  const list = await service.getByInspection(ctx.inspectionId!)
  expect(list.length).toBeGreaterThanOrEqual(2)
})
