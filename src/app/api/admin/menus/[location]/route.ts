import { prisma } from '@/lib/prisma'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { menuSaveSchema } from '@/lib/admin-schemas'
import { revalidateMenus } from '@/lib/revalidate'
import type { MenuLocation } from '@prisma/client'

export const runtime = 'nodejs'

function parseLocation(value: string): MenuLocation | null {
  const upper = value.toUpperCase()
  return upper === 'HEADER' || upper === 'FOOTER' ? upper : null
}

export async function GET(_request: Request, ctx: { params: Promise<{ location: string }> }): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const location = parseLocation((await ctx.params).location)
  if (!location) return fail('Unknown menu location', 404)

  const menu = await prisma.menu.findFirst({
    where: { location },
    include: { items: { orderBy: { order: 'asc' } } },
  })
  return ok(menu)
}

/**
 * Replaces a menu's items wholesale.
 *
 * Nesting is expressed with a temporary `parentId` referring to another item's
 * client-side id; the mapping is resolved to real database ids in a second pass
 * so a parent can be created after its child in the payload.
 */
export async function PUT(request: Request, ctx: { params: Promise<{ location: string }> }): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const location = parseLocation((await ctx.params).location)
  if (!location) return fail('Unknown menu location', 404)

  const body = await parseBody(request, menuSaveSchema)
  if (!body.ok) return body.response

  const slug = location.toLowerCase()
  const menu = await prisma.menu.upsert({
    where: { slug },
    create: { slug, name: `${location === 'HEADER' ? 'Header' : 'Footer'} menu`, location },
    update: {},
  })

  await prisma.menuItem.deleteMany({ where: { menuId: menu.id } })

  // Pass one: create every item flat, remembering the client id it came from.
  const idMap = new Map<string, string>()
  for (const item of body.data.items) {
    const created = await prisma.menuItem.create({
      data: {
        menuId: menu.id,
        kind: item.kind,
        label: item.label,
        url: item.url,
        column: item.column ?? null,
        order: item.order,
        rel: item.rel ?? null,
        target: item.target ?? null,
        visible: item.visible,
        isCta: item.isCta,
      },
    })
    if (item.id) idMap.set(item.id, created.id)
    else idMap.set(`${item.label}:${item.order}`, created.id)
  }

  // Pass two: wire up parents now that every id exists.
  for (const item of body.data.items) {
    if (!item.parentId) continue
    const childId = idMap.get(item.id ?? `${item.label}:${item.order}`)
    const parentId = idMap.get(item.parentId)
    if (childId && parentId && childId !== parentId) {
      await prisma.menuItem.update({ where: { id: childId }, data: { parentId } })
    }
  }

  revalidateMenus()

  const saved = await prisma.menu.findUnique({
    where: { id: menu.id },
    include: { items: { orderBy: { order: 'asc' } } },
  })
  return ok(saved)
}
