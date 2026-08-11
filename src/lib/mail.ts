import 'server-only'
import nodemailer from 'nodemailer'
import { getSettings } from '@/lib/settings'

/**
 * Outbound mail. Submissions are persisted to MySQL before this is called, so a
 * mail failure never loses a lead — it is recorded on the submission row and
 * surfaced in the admin inbox instead.
 */

/**
 * Splits a recipient list into individual addresses.
 *
 * The notify field accepts several addresses separated by commas or
 * semicolons so a submission can reach dispatch, sales and an owner at once.
 * Blank entries and stray whitespace are dropped rather than producing an
 * invalid header.
 */
export function recipientList(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((address) => address.trim())
    .filter((address) => address.includes('@'))
}

export interface MailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from: string
  notifyTo: string
  /** Where the settings came from, for the admin screen to report. */
  source: 'settings' | 'environment' | 'none'
}

/**
 * Resolves the SMTP configuration.
 *
 * The settings group wins when a host is set there, so mail can be repointed
 * from /admin/mail without a redeploy. With no host in settings it falls back
 * to the SMTP_* environment variables, which is how this was configured
 * before, so an existing deployment keeps working with nothing to change.
 */
export async function mailConfig(): Promise<MailConfig> {
  const { mail, organization } = await getSettings()

  if (mail.host) {
    return {
      host: mail.host,
      port: mail.port,
      secure: mail.secure,
      user: mail.user,
      password: mail.password,
      from: mail.fromEmail ? `${mail.fromName} <${mail.fromEmail}>` : mail.fromName,
      notifyTo: mail.notifyTo || organization.email,
      source: 'settings',
    }
  }

  const host = process.env.SMTP_HOST ?? ''
  return {
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    from: process.env.SMTP_FROM || 'Knights Coaches <no-reply@knightscoaches.com>',
    notifyTo: organization.email,
    source: host ? 'environment' : 'none',
  }
}

/**
 * A transport is built per send rather than cached.
 *
 * The configuration now lives in the database, so a cached transport would
 * keep using the old server after an admin changed it. Creating one is cheap;
 * nodemailer pools the underlying connection itself.
 */
async function getTransporter(): Promise<{ transport: nodemailer.Transporter; config: MailConfig } | null> {
  const config = await mailConfig()
  if (!config.host) return null

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
  })
  return { transport, config }
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
  const resolved = await getTransporter()
  if (!resolved) {
    return { sent: false, error: 'SMTP is not configured — set a host in /admin/mail or SMTP_HOST' }
  }
  try {
    await resolved.transport.sendMail({
      from: resolved.config.from,
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
