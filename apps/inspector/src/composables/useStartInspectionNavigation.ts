/**
 * Resolve inspectionId + executionId for checklist route (permit detail → execution).
 * Reuses open checklist executions; online creates execution via API; offline uses deterministic local id.
 */
import { getApiBaseUrl } from '@/lib/api-base'
import type { PermitDetailInspection } from '@/composables/usePermitDetail'

function firstIncompleteExecutionId(inspection: PermitDetailInspection): string | undefined {
  const list = inspection.checklistExecutions
  if (!list?.length) return undefined
  const open = list.find((e) => e.completedAt == null || e.completedAt === '')
  return open?.id
}

export async function resolveChecklistExecutionRoute(params: {
  inspection: PermitDetailInspection
  isOnline: boolean
  accessToken: string | null
}): Promise<{ inspectionId: string; executionId: string }> {
  const { inspection, isOnline, accessToken } = params
  const existing = firstIncompleteExecutionId(inspection)
  if (existing) {
    return { inspectionId: inspection.id, executionId: existing }
  }

  if (isOnline) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`

    const base = getApiBaseUrl()
    const prefix = base ? `${base}/api` : '/api'

    const tplRes = await fetch(`${prefix}/checklists/templates`, { headers })
    if (!tplRes.ok) {
      const text = await tplRes.text()
      throw new Error(text || 'Could not load checklist templates')
    }
    const templates = (await tplRes.json()) as { id: string }[]
    const templateId = templates[0]?.id
    if (!templateId) throw new Error('No checklist templates available')

    const execRes = await fetch(`${prefix}/checklists/executions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ inspectionId: inspection.id, templateId }),
    })
    if (!execRes.ok) {
      let msg = 'Could not start checklist'
      try {
        const body = (await execRes.json()) as { error?: string; message?: string }
        msg = body.message || body.error || msg
      } catch {
        /* ignore */
      }
      throw new Error(msg)
    }
    const created = (await execRes.json()) as { id: string }
    return { inspectionId: inspection.id, executionId: created.id }
  }

  return { inspectionId: inspection.id, executionId: `local-${inspection.id}` }
}

export async function resolveChecklistExecutionRouteForConnectivity(
  inspection: PermitDetailInspection,
  connectionAvailable: boolean,
  accessToken: string | null,
): Promise<{ inspectionId: string; executionId: string }> {
  return resolveChecklistExecutionRoute({
    inspection,
    isOnline: connectionAvailable,
    accessToken,
  })
}
