import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/auth'
import { normalizeRoute } from '@/lib/utils'
import { EditToolbar } from '@/components/admin/edit-toolbar'

/**
 * Server-side gate for the front-end editing toolbar.
 *
 * For an anonymous visitor this renders `null`, so the toolbar's client
 * component is never referenced and none of its JavaScript is included in the
 * page bundle. Edit mode simply does not exist for the public.
 */
export async function EditToolbarGate({ path }: { path: string }) {
  const user = await currentUser()
  if (!user) return null
  if (user.role !== 'ADMIN' && user.role !== 'EDITOR') return null

  const route = normalizeRoute(path)
  const page = await prisma.page
    .findUnique({
      where: { path: route },
      select: {
        id: true,
        title: true,
        status: true,
        blocks: { orderBy: { order: 'asc' }, select: { id: true, type: true, order: true, visible: true } },
      },
    })
    .catch(() => null)

  if (!page) return null

  return (
    <EditToolbar
      pageId={page.id}
      pageTitle={page.title}
      pagePath={route}
      status={page.status}
      blocks={page.blocks}
      userName={user.name ?? 'Editor'}
    />
  )
}
