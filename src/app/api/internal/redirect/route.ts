import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { normalizeRoute } from '@/lib/utils'

/**
 * Redirect lookup for the edge middleware.
 *
 * Middleware cannot hold a MySQL connection, so it calls this Node-runtime
 * route instead. The whole redirect table is small and is cached under the
 * 'redirects' tag, which the admin invalidates on save.
 */
export const runtime = 'nodejs'

const loadRedirects = unstable_cache(
  async (): Promise<Record<string, { to: string; status: number }>> => {
    try {
      const rows = await prisma.redirect.findMany({
        where: { enabled: true },
        select: { from: true, to: true, kind: true },
      })
      const map: Record<string, { to: string; status: number }> = {}
      for (const row of rows) {
        map[normalizeRoute(row.from)] = { to: row.to, status: row.kind === 'TEMPORARY' ? 302 : 301 }
      }
      return map
    } catch {
      return {}
    }
  },
  ['redirects'],
  { tags: ['redirects'], revalidate: 600 },
)

export async function GET(request: Request): Promise<Response> {
  const from = new URL(request.url).searchParams.get('from')
  if (!from) return Response.json({}, { status: 400 })

  const table = await loadRedirects()
  const hit = table[normalizeRoute(from)]
  if (!hit) return Response.json({})

  // Fire-and-forget hit counter; never block the redirect on it.
  prisma.redirect
    .updateMany({ where: { from: normalizeRoute(from) }, data: { hits: { increment: 1 } } })
    .catch(() => undefined)

  return Response.json(hit)
}
