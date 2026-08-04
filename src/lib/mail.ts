import 'server-only'
import nodemailer from 'nodemailer'

/**
 * Outbound mail. Submissions are persisted to MySQL before this is called, so a
 * mail failure never loses a lead — it is recorded on the submission row and
 * surfaced in the admin inbox instead.
 */

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter
  const host = process.env.SMTP_HOST
  if (!host) return null

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  })
  return transporter
}

export interface MailResult {
  sent: boolean
  error: string | null
}

export async function sendMail(input: {
  to: string
  subject: string
  text: string
  html?: string
  replyTo?: string
}): Promise<MailResult> {
  const transport = getTransporter()
  if (!transport) {
    return { sent: false, error: 'SMTP is not configured (SMTP_HOST is empty)' }
  }
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || 'Knights Coaches <no-reply@knightscoaches.com>',
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
    })
    return { sent: true, error: null }
  } catch (error) {
    return { sent: false, error: (error as Error).message }
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
