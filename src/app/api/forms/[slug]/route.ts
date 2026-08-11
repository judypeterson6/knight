import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/settings'
import { escapeHtml, mailConfig, recipientList, sendMail } from '@/lib/mail'
import { checkRateLimit, clientIp, verifyTurnstile } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * Public form endpoint.
 *
 * Validation is built dynamically from the FormField rows so the rules always
 * match what the visitor was shown. Protection is honeypot + rate limit +
 * optional Turnstile. The submission is written to MySQL before the notification
 * email is attempted, so a mail outage never loses a lead.
 */

const payloadSchema = z.record(z.string(), z.string().max(20_000))

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params
  const ip = clientIp(request)

  const limit = checkRateLimit(`form:${slug}:${ip}`)
  if (!limit.ok) {
    return Response.json(
      { ok: false, error: 'Too many requests. Please call us and we will take the details by phone.' },
      { status: 429, headers: { 'retry-after': String(limit.retryAfter) } },
    )
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'Malformed request.' }, { status: 400 })
  }

  const parsed = payloadSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'Malformed request.' }, { status: 400 })
  }
  const data = parsed.data

  // Honeypot: a real visitor never fills a field they cannot see.
  if (data.company_website) {
    return Response.json({ ok: true })
  }

  if (!(await verifyTurnstile(data['cf-turnstile-response'], ip))) {
    return Response.json({ ok: false, error: 'Spam check failed. Please try again.' }, { status: 400 })
  }

  const form = await prisma.form
    .findUnique({ where: { slug }, include: { fields: { orderBy: { order: 'asc' } } } })
    .catch(() => null)

  if (!form || !form.enabled) {
    return Response.json({ ok: false, error: 'This form is not accepting submissions.' }, { status: 404 })
  }

  // Build the validator from the stored field definitions.
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of form.fields) {
    if (field.type === 'HIDDEN') continue
    let rule: z.ZodTypeAny =
      field.type === 'EMAIL'
        ? z.string().email('Enter a valid email address')
        : field.type === 'NUMBER'
          ? z.string().regex(/^\d+$/, 'Enter a number')
          : z.string()

    if (field.required) {
      rule = field.type === 'CHECKBOX' ? z.literal('yes') : (rule as z.ZodString).min(1, `${field.label} is required`)
    } else {
      rule = rule.optional().or(z.literal(''))
    }
    shape[field.name] = rule
  }

  const validated = z.object(shape).safeParse(data)
  if (!validated.success) {
    const first = validated.error.errors[0]
    // A field absent from the payload trips Zod's own "Required" before the
    // per-field message can fire, which tells the visitor nothing about which
    // field to fix. Map the failing path back to its label.
    const label = form.fields.find((f) => f.name === first?.path[0])?.label
    const message =
      first?.message && first.message !== 'Required'
        ? first.message
        : label
          ? `${label} is required`
          : 'Please check the form and try again.'
    return Response.json({ ok: false, error: message }, { status: 400 })
  }

  // Keep only fields the form actually declares.
  const clean: Record<string, string> = {}
  for (const field of form.fields) {
    const value = data[field.name]
    if (value !== undefined && value !== '') clean[field.label] = value
  }

  const submission = await prisma.formSubmission.create({
    data: {
      formId: form.id,
      data: clean,
      ip,
      userAgent: request.headers.get('user-agent')?.slice(0, 400) ?? null,
    },
  })

  // Mirror contact-shaped submissions into the ContactMessage inbox.
  const emailValue = form.fields.find((f) => f.type === 'EMAIL')?.label
  const nameValue = form.fields.find((f) => /name/i.test(f.name))?.label
  if (emailValue && clean[emailValue]) {
    await prisma.contactMessage
      .create({
        data: {
          name: (nameValue && clean[nameValue]) || 'Website visitor',
          email: clean[emailValue],
          phone: Object.entries(clean).find(([k]) => /phone/i.test(k))?.[1] ?? null,
          subject: form.name,
          message: Object.entries(clean)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n'),
          ip,
          userAgent: request.headers.get('user-agent')?.slice(0, 400) ?? null,
        },
      })
      .catch(() => undefined)
  }

  const { organization } = await getSettings()
  // Most specific wins: this form's own address, then the site-wide list set in
  // /admin/mail, then the legacy environment variable, then the org address.
  // Every layer accepts several comma-separated addresses, so a submission can
  // reach dispatch, sales and an owner from one setting.
  const { notifyTo } = await mailConfig()
  const recipients = recipientList(form.notifyEmail || notifyTo || process.env.FORM_NOTIFY_EMAIL || organization.email)
  const to = recipients.join(', ')
  const lines = Object.entries(clean).map(([k, v]) => `${k}: ${v}`)

  const mail = await sendMail({
    to,
    replyTo: emailValue ? clean[emailValue] : undefined,
    subject: `[${organization.name}] ${form.name}`,
    text: lines.join('\n'),
    html: `<h2>${escapeHtml(form.name)}</h2><table>${Object.entries(clean)
      .map(([k, v]) => `<tr><th align="left">${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
      .join('')}</table>`,
  })

  await prisma.formSubmission
    .update({ where: { id: submission.id }, data: { emailed: mail.sent, emailError: mail.error } })
    .catch(() => undefined)

  return Response.json({ ok: true, id: submission.id })
}
