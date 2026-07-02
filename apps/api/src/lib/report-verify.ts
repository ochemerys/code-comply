/** Public verification URL for report QR codes (admin portal page). */
export function buildReportVerifyUrl(reportId: string, hash: string): string {
  const base = (
    process.env.ADMIN_URL?.trim() ||
    process.env.API_PUBLIC_URL?.trim() ||
    'http://localhost:5174'
  ).replace(/\/$/, '')
  return `${base}/reports/verify/${encodeURIComponent(reportId)}?hash=${encodeURIComponent(hash)}`
}

/** Format inspection unique id for display (falls back to report id). */
export function formatUniqueReportId(
  uniqueId: string | null | undefined,
  reportId: string,
): string {
  if (uniqueId && uniqueId.trim().length > 0) return uniqueId
  return reportId
}
