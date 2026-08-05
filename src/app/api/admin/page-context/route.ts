import { prisma } from '@/lib/prisma'
import { fail, guard, ok } from '@/lib/api'
import { normalizeRoute } from '@/lib/utils'

export const runtime = 'nodejs'

/**
 * Resolves the page a front-end editor is currently looking at.
 *
 * Called by the edit toolbar after mount, so the site layout itself performs no
 * database work. Guarded like every other admin endpoint — an anonymous request
 * gets a 401 and learns nothing.
 */
export async function GET(request: Request): Promise<Response> {
  const gate = await guard('EDITOR')
  if (!gate.ok) return gate.response

  const raw = new URL(request.url).searchParams.get('path')
  if (!raw) return fail('path is required')

  const page = await prisma.page
    .findUnique({
      where: { path: normalizeRoute(raw) },
      select: {
        id: true,
        title: true,
        path: true,
        status: true,
        blocks: { orderBy: { order: 'asc' }, select: { id: true, type: true, order: true, visible: true } },
      },
    })
    .catch(() => null)

  // Not every public URL is a Page row — /fleet/[slug] and /blog/[slug] are
  // their own routes. Returning null lets the toolbar render its read-only state
  // rather than an error.
  return ok(page)
}
