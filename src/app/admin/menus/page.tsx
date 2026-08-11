import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader, Panel } from '@/components/admin/ui'
import { MenuBuilder, type MenuItemDraft } from '@/components/admin/menu-builder'

export const dynamic = 'force-dynamic'

export default async function MenusAdmin() {
  const gate = await requireRole('ADMIN')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const [header, footer, pages, posts, coaches, categories] = await Promise.all([
    prisma.menu.findFirst({ where: { location: 'HEADER' }, include: { items: { orderBy: { order: 'asc' } } } }).catch(() => null),
    prisma.menu.findFirst({ where: { location: 'FOOTER' }, include: { items: { orderBy: { order: 'asc' } } } }).catch(() => null),
    prisma.page.findMany({ where: { status: 'PUBLISHED' }, select: { title: true, path: true }, orderBy: { path: 'asc' } }).catch(() => []),
    prisma.post.findMany({ where: { status: 'PUBLISHED' }, select: { title: true, slug: true } }).catch(() => []),
    prisma.coach.findMany({ where: { status: 'PUBLISHED' }, select: { name: true, slug: true } }).catch(() => []),
    prisma.category.findMany({ select: { name: true, slug: true } }).catch(() => []),
  ])

  const targets = [
    ...pages.map((p) => ({ group: 'Pages', label: p.title, url: p.path })),
    ...coaches.map((c) => ({ group: 'Fleet', label: c.name, url: `/fleet/${c.slug}` })),
    ...categories.map((c) => ({ group: 'Categories', label: c.name, url: `/guides/category/${c.slug}` })),
    ...posts.map((p) => ({ group: 'Posts', label: p.title, url: `/guides/${p.slug}` })),
  ]

  const toDraft = (items: typeof header extends null ? never : NonNullable<typeof header>['items']): MenuItemDraft[] =>
    items.map((item) => ({
      id: item.id,
      parentId: item.parentId,
      kind: item.kind,
      label: item.label,
      url: item.url,
      column: item.column,
      order: item.order,
      rel: item.rel,
      target: item.target,
      visible: item.visible,
      isCta: item.isCta,
    }))

  return (
    <>
      <AdminPageHeader
        title="Menus"
        description="Menus render server-side from these rows. Pick one canonical URL per topic — the live WordPress footer linked to two different leasing URLs and two different nationwide URLs, and those duplicates are now 301s."
      />

      <Panel title="Header menu" description="Ordering, nesting and the phone CTA item." className="mb-8">
        <MenuBuilder location="HEADER" initial={header ? toDraft(header.items) : []} targets={targets} showColumns={false} />
      </Panel>

      <Panel title="Footer menu" description="Group items into columns. A top-level item with children becomes that column's heading.">
        <MenuBuilder location="FOOTER" initial={footer ? toDraft(footer.items) : []} targets={targets} showColumns />
      </Panel>
    </>
  )
}
