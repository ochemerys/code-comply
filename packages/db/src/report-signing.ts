import { prisma, type Prisma } from './client.js'

export type ReportSigningFields = {
  signedAt: Date
  signatureImage: string
  signedByUserId: string
}

/** Persist electronic signature metadata on a generated report (LSC-A-06). */
export async function persistReportSignature(reportId: string, fields: ReportSigningFields) {
  const data: Prisma.ReportUncheckedUpdateInput = fields
  return prisma.report.update({
    where: { id: reportId },
    data,
  })
}
