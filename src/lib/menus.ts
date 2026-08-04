import 'server-only'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import type { MenuLocation } from '@prisma/client'

export interface MenuNode {
  id: string
  label: string
  url: string
  rel: string | null
  target: string | null
  column: number | null
  isCta: boolean
  children: MenuNode[]
}

async function loadMenu(location: MenuLocation): Promise<MenuNode[]> {
  try {
    const menu = await prisma.menu.findFirst({
      where: { location },
      include: { items: { where: { visible: true }, orderBy: { order: 'asc' } } },
    })
    if (!menu) return []

    const byId = new Map<string, MenuNode>()
    for (const item of menu.items) {
      byId.set(item.id, {
        id: item.id,
        label: item.label,
        url: item.url,
        rel: item.rel,
        target: item.target,
        column: item.column,
        isCta: item.isCta,
        children: [],
      })
    }
    const roots: MenuNode[] = []
    for (const item of menu.items) {
      const node = byId.get(item.id)
      if (!node) continue
      if (item.parentId && byId.has(item.parentId)) {
        byId.get(item.parentId)?.children.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots
  } catch {
    return []
  }
}

export const getMenu = (location: MenuLocation) =>
  unstable_cache(() => loadMenu(location), ['menu', location], {
    tags: ['menus', `menu:${location}`],
    revalidate: 3600,
  })()
