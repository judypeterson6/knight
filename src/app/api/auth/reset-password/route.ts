import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { fail, ok, parseBody } from '@/lib/api'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const schema = z.object({
  token: z.string().min(32).max(200),
  password: z.string().min(10, 'Use at least 10 characters').max(200),
})

/** Completes a password reset. The token is single-use and expires after an hour. */
export async function POST(request: Request): Promise<Response> {
  const limit = checkRateLimit(`reset:${clientIp(request)}`, 10, 15 * 60 * 1000)
  if (!limit.ok) {
    return fail('Too many attempts. Try again shortly.', 429)
  }

  const body = await parseBody(request, schema)
  if (!body.ok) return body.response

  const hashed = createHash('sha256').update(body.data.token).digest('hex')

  const user = await prisma.user.findUnique({ where: { resetToken: hashed } }).catch(() => null)
  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    return fail('That reset link is invalid or has expired. Request a new one.', 400)
  }
  if (!user.active) return fail('That account is inactive. Contact an administrator.', 403)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(body.data.password, 12),
      // Single use: clear the token so the same link cannot be replayed.
      resetToken: null,
      resetTokenExpiry: null,
    },
  })

  return ok({ message: 'Password updated. You can sign in now.' })
}
