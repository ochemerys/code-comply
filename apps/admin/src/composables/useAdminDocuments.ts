import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import type {
  DocumentDTO,
  DocumentEmailResultDTO,
  DocumentSignedUrlResponse,
  EmailInspectionDocumentDTO,
  ReportDownloadUrlDTO,
  ReportDTO,
  SignInspectionDocumentDTO,
} from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { getApiBaseUrl } from '@/lib/api-base'
import { adminApiFetch } from '@/utils/admin-api-fetch'
import { parseRpcJson } from '@/api/rpc-json'
import { readApiErrorMessage } from '@/api/typed-response'
import {
  fetchInspectionReports,
  fetchReportDownloadUrl,
  postDistributeReport,
  reportTypeLabel,
} from './useAdminReports'

export { isSessionExpiredRedirectError } from '../utils/admin-api-fetch'
export { reportTypeLabel }

const UPLOAD_MIME_ALLOW = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

export function isAllowedUploadMime(mime: string): boolean {
  return UPLOAD_MIME_ALLOW.has(mime)
}

export async function fetchInspectionDocuments(inspectionId: string): Promise<DocumentDTO[]> {
  const res = await api.inspections[':id'].documents.$get({ param: { id: inspectionId } })
  return parseRpcJson(res, `Failed to load documents (${res.status})`)
}

export async function uploadInspectionDocument(
  inspectionId: string,
  file: File,
  meta?: { title?: string; description?: string },
): Promise<DocumentDTO> {
  if (!isAllowedUploadMime(file.type)) {
    throw new Error('Only PDF and image files (JPEG, PNG, WebP) are allowed')
  }

  const form = new FormData()
  form.append('inspectionId', inspectionId)
  form.append('file', file)
  if (meta?.title) form.append('title', meta.title)
  if (meta?.description) form.append('description', meta.description)

  const res = await adminApiFetch(`${getApiBaseUrl()}/api/documents`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<DocumentDTO>
}

export async function fetchDocumentDownloadUrl(documentId: string): Promise<string> {
  const res = await api.documents[':id'].url.$get({ param: { id: documentId } })
  const payload = await parseRpcJson<DocumentSignedUrlResponse>(
    res,
    `Failed to get download URL (${res.status})`,
  )
  return payload.url
}

export async function deleteInspectionDocument(documentId: string): Promise<void> {
  const res = await api.documents[':id'].$delete({ param: { id: documentId } })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
}

export async function emailInspectionDocument(
  documentId: string,
  body: EmailInspectionDocumentDTO,
): Promise<DocumentEmailResultDTO> {
  const res = await api.admin.documents[':id'].email.$post({
    param: { id: documentId },
    json: body,
  })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<DocumentEmailResultDTO>
}

export async function signInspectionDocument(
  documentId: string,
  body: SignInspectionDocumentDTO,
): Promise<DocumentDTO> {
  const res = await api.admin.documents[':id'].sign.$post({ param: { id: documentId }, json: body })
  return parseRpcJson(res, `Failed to sign document (${res.status})`)
}

export async function signGeneratedReport(
  reportId: string,
  body: SignInspectionDocumentDTO,
): Promise<ReportDTO> {
  const res = await api.admin.documents.reports[':id'].sign.$post({
    param: { id: reportId },
    json: body,
  })
  return parseRpcJson(res, `Failed to sign report (${res.status})`)
}

export async function fetchReportDownloadUrlWithFormat(
  reportId: string,
  format: 'pdf' | 'docx',
): Promise<string> {
  const res = await api.reports[':id'].download.$get({
    param: { id: reportId },
    query: { format },
  })
  const payload = await parseRpcJson<ReportDownloadUrlDTO>(
    res,
    `Failed to get download URL (${res.status})`,
  )
  return payload.url
}

export function documentSignedAt(doc: DocumentDTO): string | null {
  const signedAt = doc.metadata?.signedAt
  return typeof signedAt === 'string' ? signedAt : null
}

export function useInspectionUploadedDocuments(inspectionId: Ref<string>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'documents', 'uploaded', inspectionId.value] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchInspectionDocuments(inspectionId.value)
    },
    enabled: computed(() => auth.isAuthenticated && !!inspectionId.value),
  })
}

export function useInspectionGeneratedDocuments(inspectionId: Ref<string>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'documents', 'generated', inspectionId.value] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchInspectionReports(inspectionId.value)
    },
    enabled: computed(() => auth.isAuthenticated && !!inspectionId.value),
  })
}

export function useUploadDocumentMutation(inspectionId: Ref<string>) {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { file: File; title?: string; description?: string }) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return uploadInspectionDocument(inspectionId.value, input.file, {
        title: input.title,
        description: input.description,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'documents', 'uploaded', inspectionId.value],
      })
    },
  })
}

export function useDocumentDownloadMutation() {
  const auth = useAuthStore()

  return useMutation({
    mutationFn: async (documentId: string) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchDocumentDownloadUrl(documentId)
    },
  })
}

export function useDeleteDocumentMutation(inspectionId: Ref<string>) {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (documentId: string) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      await deleteInspectionDocument(documentId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'documents', 'uploaded', inspectionId.value],
      })
    },
  })
}

export function useEmailDocumentMutation() {
  const auth = useAuthStore()

  return useMutation({
    mutationFn: async (input: { documentId: string; body: EmailInspectionDocumentDTO }) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return emailInspectionDocument(input.documentId, input.body)
    },
  })
}

export function useSignDocumentMutation(inspectionId: Ref<string>) {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { documentId: string; body: SignInspectionDocumentDTO }) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return signInspectionDocument(input.documentId, input.body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'documents', 'uploaded', inspectionId.value],
      })
    },
  })
}

export function useSignReportMutation(inspectionId: Ref<string>) {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { reportId: string; body: SignInspectionDocumentDTO }) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return signGeneratedReport(input.reportId, input.body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'documents', 'generated', inspectionId.value],
      })
    },
  })
}

export function useReportFormatDownloadMutation() {
  const auth = useAuthStore()

  return useMutation({
    mutationFn: async (input: { reportId: string; format: 'pdf' | 'docx' }) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchReportDownloadUrlWithFormat(input.reportId, input.format)
    },
  })
}

export { fetchReportDownloadUrl, postDistributeReport }
