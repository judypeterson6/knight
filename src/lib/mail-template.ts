import { escapeHtml } from '@/lib/mail'

/**
 * Notification email for a form submission.
 *
 * The first version sent a bare `<h2>` followed by an unwrapped `<table>`.
 * Fragments like that score badly with spam filters, which expect a complete
 * document, a declared charset and a plain-text alternative that actually
 * matches the HTML. The server was accepting the message and it was not
 * reaching the inbox.
 *
 * Everything is inline-styled and table-free where possible, because mail
 * clients strip <style> blocks and ignore most modern CSS.
 */
export function submissionEmail(input: {
  formName: string
  organizationName: string
  siteUrl: string
  fields: Record<string, string>
  submittedAt: Date
  ip: string | null
}): { subject: string; text: string; html: string } {
  const entries = Object.entries(input.fields)

  // No bracket prefix in the subject. "[Brand] thing" reads as a mailing list
  // to several filters, and this is one-to-one transactional mail.
  const subject = `${input.formName} from ${firstMeaningful(entries) ?? 'a website visitor'}`

  const stamp = input.submittedAt.toISOString().replace('T', ' ').slice(0, 16)

  const text = [
    `${input.formName}`,
    `Received ${stamp} UTC via ${input.siteUrl}`,
    '',
    ...entries.map(([label, value]) => `${label}: ${value}`),
    '',
    input.ip ? `Submitted from ${input.ip}` : '',
    `Reply directly to this email to reach the sender.`,
  ]
    .filter(Boolean)
    .join('\n')

  const rows = entries
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #eee7dd;font-family:Arial,sans-serif;font-size:13px;color:#5f5a53;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #eee7dd;font-family:Arial,sans-serif;font-size:14px;color:#14110e;font-weight:bold;">${escapeHtml(value).replace(/\n/g, '<br>')}</td>
        </tr>`,
    )
    .join('')

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px;background:#faf8f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #eee7dd;border-radius:12px;">
    <tr>
      <td style="padding:22px 24px;border-bottom:1px solid #eee7dd;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;color:#14110e;">${escapeHtml(input.formName)}</p>
        <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#6b655c;">Received ${escapeHtml(stamp)} UTC via ${escapeHtml(input.siteUrl)}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 8px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rows}</table>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px;background:#faf8f5;border-top:1px solid #eee7dd;border-radius:0 0 12px 12px;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#6b655c;">
          Reply directly to this email to reach the sender.${input.ip ? ` Submitted from ${escapeHtml(input.ip)}.` : ''}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}

/** A name or company from the submission, for the subject line. */
function firstMeaningful(entries: [string, string][]): string | null {
  const named = entries.find(([label]) => /name|company|artist|organis|organiz/i.test(label))
  return named?.[1]?.trim() || null
}
