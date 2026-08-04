import { prisma } from '@/lib/prisma'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { formUpdateSchema } from '@/lib/admin-schemas'
import { revalidateForms } from '@/lib/revalidate'

export const runtime = 'nodejs'

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const { slug } = await ctx.params
  const form = await prisma.form.findUnique({ where: { slug }, include: { fields: { orderBy: { order: 'asc' } } } })
  if (!form) return fail('Form not found', 404)
  return ok(form)
}

export async function PATCH(request: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const { slug } = await ctx.params
  const body = await parseBody(request, formUpdateSchema)
  if (!body.ok) return body.response

  const form = await prisma.form.update({ where: { slug }, data: body.data }).catch(() => null)
  if (!form) return fail('Form not found', 404)

  revalidateForms(slug)
  return ok(form)
}
