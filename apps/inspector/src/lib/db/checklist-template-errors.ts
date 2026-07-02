/**
 * Typed errors when a real checklist template cannot be resolved offline.
 */

export const CHECKLIST_TEMPLATE_UNAVAILABLE_CODE = 'CHECKLIST_TEMPLATE_UNAVAILABLE' as const

export class ChecklistTemplateUnavailableError extends Error {
  readonly code = CHECKLIST_TEMPLATE_UNAVAILABLE_CODE

  constructor(
    message = 'Checklist template is not cached and could not be loaded from the server.',
  ) {
    super(message)
    this.name = 'ChecklistTemplateUnavailableError'
  }
}

export function isChecklistTemplateUnavailableError(
  error: unknown,
): error is ChecklistTemplateUnavailableError {
  return error instanceof ChecklistTemplateUnavailableError
}
