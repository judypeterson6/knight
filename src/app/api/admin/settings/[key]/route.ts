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
  const value = { ...(DEFAULTS[key] as object), ...((row?.value as object) ?? {}) }
  return ok({ key, value: redactSecrets(key, value) })
}

/**
 * Strips write-only fields before a settings group leaves the server.
 *
 * The SMTP password is the only one so far. It is replaced with an empty
 * string plus a flag saying whether one is stored, so the editor can show
 * "a password is saved" without ever shipping it to the browser.
 */
function redactSecrets(key: SettingKey, value: Record<string, unknown>): Record<string, unknown> {
  if (key !== 'mail') return value
  const { password, ...rest } = value as { password?: string }
  return { ...rest, password: '', hasPassword: Boolean(password) }
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

  const existing = await prisma.setting.findUnique({ where: { key } })
  const stored = (existing?.value as Record<string, unknown>) ?? {}

  // The editor never receives the SMTP password, so it cannot send it back. An
  // empty value means "unchanged", not "clear it" — otherwise saving any other
  // mail field would silently wipe the password and break outbound mail.
  const incoming = { ...body.data.value } as Record<string, unknown>
  if (key === 'mail' && !String(incoming.password ?? '')) {
    incoming.password = stored.password ?? ''
  }
  delete incoming.hasPassword

  const merged = { ...(DEFAULTS[key] as object), ...incoming }
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
  return ok({ key, value: redactSecrets(key, parsed.data as Record<string, unknown>) })
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
