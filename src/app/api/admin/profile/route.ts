import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { profileUpdateSchema } from '@/lib/admin-schemas'

export const runtime = 'nodejs'

/** Self-service profile edit. A password change always requires the current one. */
export async function PATCH(request: Request): Promise<Response> {
  const gate = await guard('AUTHOR')
  if (!gate.ok) return gate.response

  const body = await parseBody(request, profileUpdateSchema)
  if (!body.ok) return body.response

  const user = await prisma.user.findUnique({ where: { id: gate.user.id } })
  if (!user) return fail('Account not found', 404)

  let passwordHash: string | undefined
  if (body.data.newPassword) {
    if (!body.data.currentPassword) return fail('Enter your current password to change it.', 422)
    const valid = await bcrypt.compare(body.data.currentPassword, user.passwordHash)
    if (!valid) return fail('Your current password is not correct.', 403)
    passwordHash = await bcrypt.hash(body.data.newPassword, 12)
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: body.data.name,
      bio: body.data.bio ?? null,
      ...(body.data.avatarId !== undefined ? { avatarId: body.data.avatarId } : {}),
      ...(passwordHash ? { passwordHash } : {}),
    },
    select: { id: true, name: true, email: true, role: true, bio: true },
  })

  return ok(updated)
}
