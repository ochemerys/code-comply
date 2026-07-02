/**
 * Parse a Hono client Response with shared error messaging (online mutations / sync).
 */

export async function readApiErrorMessage(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const j = JSON.parse(text) as { error?: string; message?: string }
    return j.message || j.error || text || `Request failed (${res.status})`
  } catch {
    return text || `Request failed (${res.status})`
  }
}

export function etagFromResponse(res: Response): string | undefined {
  const h = res.headers.get('ETag')
  if (!h) return undefined
  const v = h.trim()
  if (v.startsWith('W/"') && v.endsWith('"')) return v.slice(3, -1)
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1)
  return v
}
