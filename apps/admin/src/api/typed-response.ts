/**
 * Parse a Hono client Response with shared error messaging.
 */

function formatApiErrorBody(j: {
  error?: unknown
  message?: string
  issues?: Array<{ message?: string; path?: Array<string | number> }>
}): string | undefined {
  if (typeof j.message === 'string' && j.message.trim()) return j.message
  if (Array.isArray(j.issues) && j.issues.length > 0) {
    return j.issues
      .map((issue) => issue.message)
      .filter(Boolean)
      .join('; ')
  }
  if (typeof j.error === 'string' && j.error.trim()) return j.error
  if (j.error && typeof j.error === 'object') {
    const nested = j.error as {
      message?: string
      issues?: Array<{ message?: string }>
    }
    if (typeof nested.message === 'string' && nested.message.trim()) return nested.message
    if (Array.isArray(nested.issues) && nested.issues.length > 0) {
      return nested.issues
        .map((issue) => issue.message)
        .filter(Boolean)
        .join('; ')
    }
  }
  return undefined
}

export async function readApiErrorMessage(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const j = JSON.parse(text) as {
      error?: unknown
      message?: string
      issues?: Array<{ message?: string; path?: Array<string | number> }>
    }
    return formatApiErrorBody(j) || text || `Request failed (${res.status})`
  } catch {
    return text || `Request failed (${res.status})`
  }
}
