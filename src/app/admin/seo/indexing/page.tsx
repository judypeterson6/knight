import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { quotaFor, quotaUsedToday } from '@/lib/indexing'
import { AdminPageHeader } from '@/components/admin/ui'
import { IndexingConsole } from '@/components/admin/indexing-console'

export const dynamic = 'force-dynamic'

export default async function IndexingAdmin() {
  const gate = await requireRole('ADMIN')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const [logs, indexNowUsed, googleUsed, pages, posts, coaches] = await Promise.all([
    prisma.indexingLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }).catch(() => []),
    quotaUsedToday('INDEXNOW'),
    quotaUsedToday('GOOGLE'),
    prisma.page.findMany({ where: { status: 'PUBLISHED' }, select: { path: true }, orderBy: { path: 'asc' } }).catch(() => []),
    prisma.post.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true } }).catch(() => []),
    prisma.coach.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true } }).catch(() => []),
  ])

  const allUrls = [
    ...pages.map((p) => p.path),
    ...posts.map((p) => `/guides/${p.slug}`),
    ...coaches.map((c) => `/fleet/${c.slug}`),
  ]

  return (
    <>
      <AdminPageHeader
        title="Indexing"
        description="Submit changed URLs to IndexNow and the Google Indexing API, and ping the sitemap. Publishing does this automatically; this screen is for manual and bulk submission."
      />

      <div className="mb-6 rounded-card border border-line bg-surface-alt p-5 text-step--1 leading-relaxed text-muted">
        <p className="font-bold text-ink">About the Google Indexing API</p>
        <p className="mt-2">
          Google officially restricts that API to pages carrying <code>JobPosting</code> or <code>BroadcastEvent</code>{' '}
          structured data. Submissions for service, fleet and blog URLs are generally accepted and then ignored, so the
          call is wired up here for completeness but the XML sitemap plus Search Console remains the real path to
          indexation for this site. IndexNow, by contrast, works today for Bing, Yandex, Seznam and Naver.
        </p>
      </div>

      <IndexingConsole
        logs={logs.map((log) => ({
          id: log.id,
          url: log.url,
          provider: log.provider,
          action: log.action,
          status: log.status,
          code: log.code,
          response: log.response,
          attempts: log.attempts,
          createdAt: log.createdAt.toISOString(),
        }))}
        quota={{
          indexNow: { used: indexNowUsed, limit: quotaFor('INDEXNOW') },
          google: { used: googleUsed, limit: quotaFor('GOOGLE') },
        }}
        configured={{
          indexNow: Boolean(process.env.INDEXNOW_KEY),
          google: Boolean(process.env.GOOGLE_INDEXING_SA_JSON),
        }}
        allUrls={allUrls}
      />
    </>
  )
}
