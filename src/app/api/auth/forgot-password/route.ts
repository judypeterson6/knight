import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, parseBody } from '@/lib/api'
import { sendMail } from '@/lib/mail'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { absoluteUrl } from '@/lib/utils'

export const runtime = 'nodejs'

const schema = z.object({ email: z.string().email().max(320) })

/**
 * Starts a password reset.
 *
 * Always answers the same way regardless of whether the address exists — a
 * differing response would turn this into an account-enumeration oracle. The
 * token is random, stored only as a SHA-256 hash, and valid for one hour.
 */
export async function POST(request: Request): Promise<Response> {
  const ip = clientIp(request)
  const limit = checkRateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000)

  const generic = { message: 'If that address has an account, a reset link is on its way.' }
  if (!limit.ok) {
    return Response.json(
      { ok: true, data: generic },
      { headers: { 'retry-after': String(limit.retryAfter) } },
    )
  }

  const body = await parseBody(request, schema)
  if (!body.ok) return ok(generic)

  const user = await prisma.user
    .findUnique({ where: { email: body.data.email.toLowerCase() } })
    .catch(() => null)

  if (user && user.active) {
    const token = randomBytes(32).toString('hex')
    const hashed = createHash('sha256').update(token).digest('hex')

    await prisma.user
      .update({
        where: { id: user.id },
        data: { resetToken: hashed, resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000) },
      })
      .catch(() => undefined)

    const link = `${absoluteUrl('/admin/reset-password')}?token=${token}`
    await sendMail({
      to: user.email,
      subject: 'Reset your Knights Coaches admin password',
      text: [
        `Hello ${user.name},`,
        '',
        'Someone asked to reset the password on your Knights Coaches admin account.',
        'If that was not you, ignore this email — nothing has changed.',
        '',
        `Reset link (valid for one hour): ${link}`,
      ].join('\n'),
    })
  }

  return ok(generic)
}
