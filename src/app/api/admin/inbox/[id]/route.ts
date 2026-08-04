import { prisma } from '@/lib/prisma'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { messageUpdateSchema } from '@/lib/admin-schemas'

export const runtime = 'nodejs'

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await guard('EDITOR')
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const body = await parseBody(request, messageUpdateSchema)
  if (!body.ok) return body.response

  const message = await prisma.contactMessage.update({ where: { id }, data: body.data }).catch(() => null)
  if (!message) return fail('Not found', 404)
  return ok(message)
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await guard('EDITOR')
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const deleted = await prisma.contactMessage.delete({ where: { id } }).catch(() => null)
  if (!deleted) return fail('Not found', 404)
  return ok({ id })
}
