export type EmailTemplateRenderResult = {
  subject: string
  text: string
  html: string
}

export type EmailTemplateRenderer = (context: Record<string, unknown>) => EmailTemplateRenderResult

export type { EmailTemplateId } from '../email-types.js'

function str(context: Record<string, unknown>, key: string, fallback = ''): string {
  const v = context[key]
  return typeof v === 'string' ? v : fallback
}

export function renderInspectionReportTemplate(
  context: Record<string, unknown>,
): EmailTemplateRenderResult {
  const permitNumber = str(context, 'permitNumber', 'N/A')
  const inspectionId = str(context, 'inspectionId')
  const recipientName = str(context, 'recipientName', 'Recipient')
  const reportUrl = str(context, 'reportUrl')

  const subject = `Inspection Report — Permit ${permitNumber}`
  const text = [
    `Hello ${recipientName},`,
    '',
    `The inspection report for permit ${permitNumber} (inspection ${inspectionId}) is attached.`,
    reportUrl ? `Download: ${reportUrl}` : '',
    '',
    'CodeComply',
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
    <p>Hello ${recipientName},</p>
    <p>The inspection report for permit <strong>${permitNumber}</strong> (inspection ${inspectionId}) is attached.</p>
    ${reportUrl ? `<p><a href="${reportUrl}">Download report</a></p>` : ''}
    <p>CodeComply</p>
  `.trim()

  return { subject, text, html }
}

export function renderDeficiencyNoticeTemplate(
  context: Record<string, unknown>,
): EmailTemplateRenderResult {
  const permitNumber = str(context, 'permitNumber', 'N/A')
  const description = str(context, 'deficiencyDescription', 'See attached notice.')
  const dueDate = str(context, 'dueDate', 'as soon as possible')
  const inspectorName = str(context, 'inspectorName', 'Safety Codes Officer')

  const subject = `Deficiency Notice — Permit ${permitNumber}`
  const text = [
    `A deficiency has been recorded for permit ${permitNumber}.`,
    '',
    `Description: ${description}`,
    `Correct by: ${dueDate}`,
    `Inspector: ${inspectorName}`,
    '',
    'Please address this deficiency promptly.',
  ].join('\n')

  const html = `
    <p>A deficiency has been recorded for permit <strong>${permitNumber}</strong>.</p>
    <p><strong>Description:</strong> ${description}</p>
    <p><strong>Correct by:</strong> ${dueDate}</p>
    <p><strong>Inspector:</strong> ${inspectorName}</p>
    <p>Please address this deficiency promptly.</p>
  `.trim()

  return { subject, text, html }
}

export function renderStopWorkOrderTemplate(
  context: Record<string, unknown>,
): EmailTemplateRenderResult {
  const permitNumber = str(context, 'permitNumber', 'N/A')
  const description = str(context, 'deficiencyDescription', 'See attached order.')
  const issuedAt = str(context, 'issuedAt', new Date().toISOString())

  const subject = `STOP WORK ORDER — Permit ${permitNumber}`
  const text = [
    `STOP WORK ORDER issued for permit ${permitNumber} on ${issuedAt}.`,
    '',
    `Reason: ${description}`,
    '',
    'All work must cease until the Safety Codes Officer authorizes resumption.',
  ].join('\n')

  const html = `
    <h2>STOP WORK ORDER</h2>
    <p>Issued for permit <strong>${permitNumber}</strong> on ${issuedAt}.</p>
    <p><strong>Reason:</strong> ${description}</p>
    <p>All work must cease until the Safety Codes Officer authorizes resumption.</p>
  `.trim()

  return { subject, text, html }
}

export function renderVoCSubmissionTemplate(
  context: Record<string, unknown>,
): EmailTemplateRenderResult {
  const permitNumber = str(context, 'permitNumber', 'N/A')
  const deficiencyTitle = str(context, 'deficiencyTitle', 'Deficiency')
  const submittedBy = str(context, 'submittedBy', 'Permit holder')
  const verificationDate = str(context, 'verificationDate')

  const subject = `VoC Submitted — Permit ${permitNumber}`
  const text = [
    `Verification of Compliance submitted for permit ${permitNumber}.`,
    '',
    `Deficiency: ${deficiencyTitle}`,
    `Submitted by: ${submittedBy}`,
    verificationDate ? `Verification date: ${verificationDate}` : '',
    '',
    'An administrator will review this submission.',
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
    <p>Verification of Compliance submitted for permit <strong>${permitNumber}</strong>.</p>
    <p><strong>Deficiency:</strong> ${deficiencyTitle}</p>
    <p><strong>Submitted by:</strong> ${submittedBy}</p>
    ${verificationDate ? `<p><strong>Verification date:</strong> ${verificationDate}</p>` : ''}
    <p>An administrator will review this submission.</p>
  `.trim()

  return { subject, text, html }
}

export function renderVoCDecisionTemplate(
  context: Record<string, unknown>,
): EmailTemplateRenderResult {
  const permitNumber = str(context, 'permitNumber', 'N/A')
  const decision = str(context, 'decision', 'REVIEWED')
  const reviewerName = str(context, 'reviewerName', 'Administrator')
  const comments = str(context, 'comments')

  const subject = `VoC Decision — Permit ${permitNumber}`
  const text = [
    `Your Verification of Compliance for permit ${permitNumber} was ${decision}.`,
    `Reviewed by: ${reviewerName}`,
    comments ? `Comments: ${comments}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
    <p>Your Verification of Compliance for permit <strong>${permitNumber}</strong> was <strong>${decision}</strong>.</p>
    <p><strong>Reviewed by:</strong> ${reviewerName}</p>
    ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ''}
  `.trim()

  return { subject, text, html }
}
