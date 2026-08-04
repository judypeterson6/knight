import { prisma } from '@/lib/prisma'
import { guard, ok, parseBody } from '@/lib/api'
import { indexingSubmitSchema } from '@/lib/admin-schemas'
import { pingSitemap, quotaFor, quotaUsedToday, submitToGoogle, submitToIndexNow } from '@/lib/indexing'

export const runtime = 'nodejs'

/** Recent submissions plus today's quota counters, for the indexing screen. */
export async function GET(): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const [logs, indexNowUsed, googleUsed] = await Promise.all([
    prisma.indexingLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    quotaUsedToday('INDEXNOW'),
    quotaUsedToday('GOOGLE'),
  ])

  return ok({
    logs,
    quota: {
      indexNow: { used: indexNowUsed, limit: quotaFor('INDEXNOW') },
      google: { used: googleUsed, limit: quotaFor('GOOGLE') },
    },
    configured: {
      indexNow: Boolean(process.env.INDEXNOW_KEY),
      google: Boolean(process.env.GOOGLE_INDEXING_SA_JSON),
    },
  })
}

/** Manual submission — one URL from a page/post/coach screen, or a bulk list. */
export async function POST(request: Request): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const body = await parseBody(request, indexingSubmitSchema)
  if (!body.ok) return body.response

  const results: { provider: string; ok: boolean; message: string }[] = []

  if (body.data.providers.includes('INDEXNOW')) {
    const result = await submitToIndexNow(body.data.urls, body.data.action)
    results.push({ provider: 'IndexNow', ...result })
  }
  if (body.data.providers.includes('GOOGLE')) {
    const result = await submitToGoogle(body.data.urls, body.data.action)
    results.push({ provider: 'Google Indexing API', ...result })
  }
  if (body.data.providers.includes('SITEMAP_PING')) {
    const result = await pingSitemap()
    results.push({ provider: 'Sitemap ping', ...result })
  }

  return ok({ results })
}
