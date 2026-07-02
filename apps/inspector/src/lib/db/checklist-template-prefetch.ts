/**
 * Pre-fetch checklist templates during M-03 assigned-permits sync down.
 */

import {
  ChecklistExecutionDTOSchema,
  ChecklistTemplateDTOSchema,
  PermitDTOSchema,
} from '@codecomply/validators'
import { getApiBaseUrl } from '@/lib/api-base'
import { apiFetch } from '@/utils/api-fetch'
import { useOfflineChecklists } from '@/composables/useOfflineChecklists'

type TemplateRef = { templateId: string; versionHash: string }

/** Written during sync-down so offline `local-*` executions can resolve a real template. */
export const DEFAULT_CHECKLIST_TEMPLATE_REF_KEY = 'inspector.checklist.defaultTemplateRef'

export function persistDefaultChecklistTemplateRef(ref: TemplateRef): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(DEFAULT_CHECKLIST_TEMPLATE_REF_KEY, JSON.stringify(ref))
}

export function readDefaultChecklistTemplateRef(): TemplateRef | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(DEFAULT_CHECKLIST_TEMPLATE_REF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { templateId?: string; versionHash?: string }
    if (parsed.templateId?.trim() && parsed.versionHash?.trim()) {
      return { templateId: parsed.templateId.trim(), versionHash: parsed.versionHash.trim() }
    }
  } catch {
    /* ignore invalid storage */
  }
  return null
}

function apiPrefix(): string {
  const base = getApiBaseUrl()
  return base ? `${base}/api` : '/api'
}

function refKey(ref: TemplateRef): string {
  return `${ref.templateId}:${ref.versionHash}`
}

async function collectRefsFromPermit(
  permitId: string,
  refs: Map<string, TemplateRef>,
): Promise<void> {
  const res = await apiFetch(`${apiPrefix()}/permits/${encodeURIComponent(permitId)}`)
  if (!res.ok) return

  const permit = PermitDTOSchema.parse(await res.json())
  for (const inspection of permit.inspections ?? []) {
    for (const exRef of inspection.checklistExecutions ?? []) {
      const exRes = await apiFetch(
        `${apiPrefix()}/checklists/executions/${encodeURIComponent(exRef.id)}`,
      )
      if (!exRes.ok) continue
      const ex = ChecklistExecutionDTOSchema.parse(await exRes.json())
      const templateId = ex.templateId?.trim()
      const versionHash = ex.versionHash?.trim()
      if (!templateId || !versionHash) continue
      const ref: TemplateRef = { templateId, versionHash }
      refs.set(refKey(ref), ref)
    }
  }
}

/** Same default as `useStartInspectionNavigation` — cache for inspections not yet started. */
async function collectDefaultTemplateRef(refs: Map<string, TemplateRef>): Promise<void> {
  const tplListRes = await apiFetch(`${apiPrefix()}/checklists/templates`)
  if (!tplListRes.ok) return

  const templates = (await tplListRes.json()) as { id: string }[]
  const templateId = templates[0]?.id
  if (!templateId) return

  const tplRes = await apiFetch(
    `${apiPrefix()}/checklists/templates/${encodeURIComponent(templateId)}`,
  )
  if (!tplRes.ok) return

  const tpl = ChecklistTemplateDTOSchema.parse(await tplRes.json())
  const ref = { templateId: tpl.id, versionHash: tpl.versionHash }
  refs.set(refKey(ref), ref)
  persistDefaultChecklistTemplateRef(ref)
}

/**
 * Fetches and caches checklist templates referenced by assigned permits' inspections.
 * Safe to call fire-and-forget after assigned permit list sync.
 */
export async function prefetchChecklistTemplatesForPermitIds(permitIds: string[]): Promise<void> {
  if (!permitIds.length) return

  const refs = new Map<string, TemplateRef>()
  await Promise.all(permitIds.map((id) => collectRefsFromPermit(id, refs)))
  await collectDefaultTemplateRef(refs)

  const { putTemplate } = useOfflineChecklists()
  for (const ref of refs.values()) {
    const tr = await apiFetch(
      `${apiPrefix()}/checklists/templates/${encodeURIComponent(ref.templateId)}`,
    )
    if (!tr.ok) continue
    const tpl = ChecklistTemplateDTOSchema.parse(await tr.json())
    if (tpl.id !== ref.templateId || tpl.versionHash !== ref.versionHash) continue
    await putTemplate(tpl)
  }
}
