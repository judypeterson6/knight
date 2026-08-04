import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { userUpdateSchema } from '@/lib/admin-schemas'
import { prismaMessage } from '@/lib/crud'

export const runtime = 'nodejs'

const SAFE_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  bio: true,
  lastLoginAt: true,
  createdAt: true,
  avatar: { select: { path: true, alt: true } },
} as const

/** True when this user is the only active admin left. */
async function isLastAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, active: true } })
  if (!user || user.role !== 'ADMIN') return false
  const others = await prisma.user.count({ where: { role: 'ADMIN', active: true, NOT: { id: userId } } })
  return others === 0
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response
  const { id } = await ctx.params
  const user = await prisma.user.findUnique({ where: { id }, select: SAFE_FIELDS })
  if (!user) return fail('Not found', 404)
  return ok(user)
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const body = await parseBody(request, userUpdateSchema)
  if (!body.ok) return body.response

  // The last remaining admin cannot demote or deactivate themselves out of the
  // system — that would lock everyone out with no recovery path.
  const losesAdmin = (body.data.role && body.data.role !== 'ADMIN') || body.data.active === false
  if (losesAdmin && (await isLastAdmin(id))) {
    return fail('This is the last active admin. Promote another admin first.', 409)
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.data.name ? { name: body.data.name } : {}),
        ...(body.data.email ? { email: body.data.email.toLowerCase() } : {}),
        ...(body.data.role ? { role: body.data.role } : {}),
        ...(body.data.bio !== undefined ? { bio: body.data.bio } : {}),
        ...(body.data.active !== undefined ? { active: body.data.active } : {}),
        ...(body.data.avatarId !== undefined ? { avatarId: body.data.avatarId } : {}),
        ...(body.data.password ? { passwordHash: await bcrypt.hash(body.data.password, 12) } : {}),
      },
      select: SAFE_FIELDS,
    })
    return ok(user)
  } catch (error) {
    return fail(prismaMessage(error), 409)
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  if (id === gate.user.id) return fail('You cannot delete your own account.', 409)
  if (await isLastAdmin(id)) return fail('This is the last active admin and cannot be deleted.', 409)

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } })
  if (!user) return fail('Not found', 404)

  // Posts survive their author: the FK is SetNull, so nothing published is lost.
  await prisma.user.delete({ where: { id } })
  return ok({ id })
}
