import { prisma } from '@/lib/prisma'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { formFieldsSchema } from '@/lib/admin-schemas'
import { revalidateForms } from '@/lib/revalidate'

export const runtime = 'nodejs'

/** Replaces a form's fields. Field names must be unique within the form. */
export async function PUT(request: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const { slug } = await ctx.params
  const body = await parseBody(request, formFieldsSchema)
  if (!body.ok) return body.response

  const form = await prisma.form.findUnique({ where: { slug }, select: { id: true } })
  if (!form) return fail('Form not found', 404)

  const names = body.data.fields.map((f) => f.name)
  const duplicate = names.find((name, i) => names.indexOf(name) !== i)
  if (duplicate) return fail(`Two fields share the name "${duplicate}". Field names must be unique.`, 422)

  // A conditional field must point at a checkbox that actually exists.
  const checkboxNames = new Set(body.data.fields.filter((f) => f.type === 'CHECKBOX').map((f) => f.name))
  const badCondition = body.data.fields.find((f) => f.showWhen && !checkboxNames.has(f.showWhen))
  if (badCondition) {
    return fail(`"${badCondition.label}" is conditional on "${badCondition.showWhen}", which is not a checkbox field.`, 422)
  }

  await prisma.$transaction([
    prisma.formField.deleteMany({ where: { formId: form.id } }),
    prisma.formField.createMany({
      data: body.data.fields.map((field, index) => ({
        formId: form.id,
        name: field.name,
        label: field.label,
        type: field.type,
        placeholder: field.placeholder ?? null,
        helpText: field.helpText ?? null,
        required: field.required,
        options: field.options ?? undefined,
        order: index,
        showWhen: field.showWhen ?? null,
        halfWidth: field.halfWidth,
      })),
    }),
  ])

  revalidateForms(slug)

  const fields = await prisma.formField.findMany({ where: { formId: form.id }, orderBy: { order: 'asc' } })
  return ok(fields)
}
