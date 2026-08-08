import { z } from 'zod'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { mailConfig, sendMail } from '@/lib/mail'

export const runtime = 'nodejs'

const testSchema = z.object({ to: z.string().email().max(320) })

/**
 * Sends one real message to prove the SMTP settings work.
 *
 * Without this an admin only finds out the configuration is wrong when a lead
 * silently fails to arrive. The failure is returned verbatim from nodemailer —
 * "Invalid login", "connect ECONNREFUSED" and so on say precisely what to fix,
 * and there is nothing secret in them.
 */
export async function POST(request: Request): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const body = await parseBody(request, testSchema)
  if (!body.ok) return body.response

  const config = await mailConfig()
  if (!config.host) {
    return fail('No SMTP host is set. Add one above, or set SMTP_HOST in the environment.', 422)
  }

  const result = await sendMail({
    to: body.data.to,
    subject: 'Knights Coaches — SMTP test',
    text: `This is a test message from the Knights Coaches admin.\n\nHost: ${config.host}:${config.port}\nFrom: ${config.from}\nConfigured in: ${config.source}\n\nIf you are reading this, outbound mail works.`,
  })

  if (!result.sent) return fail(result.error ?? 'Send failed', 502)
  return ok({ to: body.data.to, host: config.host, port: config.port, source: config.source })
}
