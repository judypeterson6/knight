import { currentUser } from '@/lib/auth'
import { EditToolbar } from '@/components/admin/edit-toolbar'

/**
 * Server-side gate for the front-end editing toolbar.
 *
 * For an anonymous visitor this returns `null`, so the toolbar's client
 * component is never referenced and none of its JavaScript reaches the page
 * bundle. Edit mode simply does not exist for the public — which is why the
 * check is here on the server rather than as a client-side probe.
 *
 * The trade-off is that reading the session opts the public routes out of the
 * full-route cache. Every database read they perform is still served from the
 * Next data cache (`unstable_cache` with tags, invalidated by `revalidateTag`
 * on save), so this costs a React render per request, not a query. The README
 * records this under "Rendering model".
 *
 * Deliberately does no database work: the toolbar resolves the page it is on
 * from /api/admin/page-context after mount, so an editor browsing the site does
 * not add a query to every page render.
 */
export async function EditToolbarGate() {
  const user = await currentUser()
  if (!user) return null
  if (user.role !== 'ADMIN' && user.role !== 'EDITOR') return null

  return <EditToolbar userName={user.name ?? 'Editor'} />
}
