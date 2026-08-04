import { prisma } from '@/lib/prisma'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { settingUpdateSchema } from '@/lib/admin-schemas'
import { DEFAULTS, schemaFor, type SettingKey } from '@/lib/settings'
import { revalidateSettings } from '@/lib/revalidate'

export const runtime = 'nodejs'

function isSettingKey(value: string): value is SettingKey {
  return value in DEFAULTS
}

export async function GET(_request: Request, ctx: { params: Promise<{ key: string }> }): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const { key } = await ctx.params
  if (!isSettingKey(key)) return fail('Unknown setting', 404)

  const row = await prisma.setting.findUnique({ where: { key } })
  return ok({ key, value: { ...(DEFAULTS[key] as object), ...((row?.value as object) ?? {}) } })
}

/**
 * Writes one settings group. The value is merged over the defaults and then
 * validated against that group's schema, so a partial save can never drop a
 * token and leave the site without a colour.
 */
export async function PUT(request: Request, ctx: { params: Promise<{ key: string }> }): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const { key } = await ctx.params
  if (!isSettingKey(key)) return fail('Unknown setting', 404)

  const body = await parseBody(request, settingUpdateSchema)
  if (!body.ok) return body.response

  const merged = { ...(DEFAULTS[key] as object), ...body.data.value }
  const parsed = schemaFor(key).safeParse(merged)
  if (!parsed.success) {
    return fail(
      parsed.error.errors[0]?.message ?? 'Invalid settings',
      422,
      parsed.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    )
  }

  await prisma.setting.upsert({
    where: { key },
    create: { key, value: parsed.data as object },
    update: { value: parsed.data as object },
  })

  revalidateSettings()
  return ok({ key, value: parsed.data })
}

/** Resets a settings group back to the shipped defaults. */
export async function DELETE(_request: Request, ctx: { params: Promise<{ key: string }> }): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const { key } = await ctx.params
  if (!isSettingKey(key)) return fail('Unknown setting', 404)

  await prisma.setting.upsert({
    where: { key },
    create: { key, value: DEFAULTS[key] as object },
    update: { value: DEFAULTS[key] as object },
  })

  revalidateSettings()
  return ok({ key, value: DEFAULTS[key] })
}
