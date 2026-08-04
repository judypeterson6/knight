import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader, Panel } from '@/components/admin/ui'
import { excerptFrom } from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface Finding {
  label: string
  href: string
  detail: string
}

/**
 * SEO audit.
 *
 * Every check runs against live data — pages missing a meta description,
 * duplicate titles, over-length titles, images with no alt text, internal links
 * that resolve to nothing, and pages nothing links to.
 */
export default async function SeoAudit() {
  const gate = await requireRole('EDITOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const [pages, posts, coaches, seoRows, media, blocks, redirects] = await Promise.all([
    prisma.page.findMany({ where: { status: 'PUBLISHED' }, select: { id: true, title: true, path: true } }).catch(() => []),
    prisma.post.findMany({ where: { status: 'PUBLISHED' }, select: { id: true, title: true, slug: true, excerpt: true } }).catch(() => []),
    prisma.coach.findMany({ where: { status: 'PUBLISHED' }, select: { id: true, name: true, slug: true } }).catch(() => []),
    prisma.seoMeta.findMany().catch(() => []),
    prisma.media.findMany({ where: { alt: '', decorative: false }, select: { id: true, filename: true, path: true } }).catch(() => []),
    prisma.pageBlock.findMany({ select: { pageId: true, props: true } }).catch(() => []),
    prisma.redirect.findMany({ where: { enabled: true }, select: { from: true } }).catch(() => []),
  ])

  const seoBy = new Map(seoRows.map((row) => [`${row.entityType}:${row.entityId}`, row]))

  const missingDescription: Finding[] = []
  const longTitles: Finding[] = []
  const titleCounts = new Map<string, Finding[]>()

  const record = (entityType: string, id: string, label: string, href: string, fallbackTitle: string) => {
    const meta = seoBy.get(`${entityType}:${id}`)
    const title = meta?.title?.trim() || fallbackTitle
    const description = meta?.description?.trim() ?? ''

    if (!description) missingDescription.push({ label, href, detail: 'No meta description — the global default is used.' })
    if (title.length > 60) longTitles.push({ label, href, detail: `${title.length} characters` })

    const key = title.toLowerCase()
    titleCounts.set(key, [...(titleCounts.get(key) ?? []), { label, href, detail: title }])
  }

  for (const page of pages) record('PAGE', page.id, page.title, page.path, page.title)
  for (const post of posts) record('POST', post.id, post.title, `/blog/${post.slug}`, post.title)
  for (const coach of coaches) record('COACH', coach.id, coach.name, `/fleet/${coach.slug}`, coach.name)

  const duplicateTitles = [...titleCounts.values()].filter((group) => group.length > 1)

  // Internal links found in block props that do not resolve to a page, coach,
  // post, category, static route or redirect.
  const validPaths = new Set<string>([
    ...pages.map((p) => p.path),
    ...posts.map((p) => `/blog/${p.slug}`),
    ...coaches.map((c) => `/fleet/${c.slug}`),
    ...redirects.map((r) => r.from),
    '/blog',
    '/sitemap',
    '/privacy-policy',
    '/terms',
    '/disclaimer',
  ])

  const pageById = new Map(pages.map((p) => [p.id, p]))
  const brokenLinks: Finding[] = []
  const linkedPaths = new Set<string>()

  for (const block of blocks) {
    const urls = collectUrls(block.props)
    for (const url of urls) {
      if (!url.startsWith('/')) continue
      const clean = url.split('#')[0].split('?')[0].replace(/\/$/, '') || '/'
      linkedPaths.add(clean)
      if (clean.startsWith('/blog/category/')) continue
      if (!validPaths.has(clean)) {
        const page = pageById.get(block.pageId)
        brokenLinks.push({
          label: page?.title ?? block.pageId,
          href: page?.path ?? '#',
          detail: `Links to ${url}, which does not resolve.`,
        })
      }
    }
  }

  const orphanPages: Finding[] = pages
    .filter((page) => page.path !== '/' && !linkedPaths.has(page.path))
    .map((page) => ({ label: page.title, href: page.path, detail: 'Nothing on the site links to this page.' }))

  const missingAlt: Finding[] = media.map((asset) => ({
    label: asset.filename,
    href: '/admin/media',
    detail: 'No alt text and not marked decorative.',
  }))

  const thinExcerpts: Finding[] = posts
    .filter((post) => excerptFrom(post.excerpt ?? '', 400).length < 60)
    .map((post) => ({ label: post.title, href: `/blog/${post.slug}`, detail: 'Excerpt is short or empty — it is the opening answer under the H1.' }))

  const groups: { title: string; description: string; findings: Finding[] }[] = [
    { title: 'Missing meta description', description: 'These URLs fall back to the site default.', findings: missingDescription },
    { title: 'Titles over 60 characters', description: 'Likely to be truncated in results.', findings: longTitles },
    { title: 'Duplicate titles', description: 'Two or more URLs share a title.', findings: duplicateTitles.flat() },
    { title: 'Images without alt text', description: 'Cannot be added to a coach gallery until fixed.', findings: missingAlt },
    { title: 'Broken internal links', description: 'A link in a block points at a path that does not resolve.', findings: brokenLinks },
    { title: 'Orphan pages', description: 'Published but not linked from any block on the site.', findings: orphanPages },
    { title: 'Thin post excerpts', description: 'The excerpt is the direct answer under the H1.', findings: thinExcerpts },
  ]

  const total = groups.reduce((sum, group) => sum + group.findings.length, 0)

  return (
    <>
      <AdminPageHeader
        title="SEO audit"
        description={total === 0 ? 'No issues found.' : `${total} issue(s) across ${groups.filter((g) => g.findings.length).length} check(s).`}
      />

      <div className="space-y-6">
        {groups.map((group) => (
          <Panel
            key={group.title}
            title={`${group.title} (${group.findings.length})`}
            description={group.description}
          >
            {group.findings.length === 0 ? (
              <p className="text-step--1 text-muted">Nothing to fix here.</p>
            ) : (
              <ul className="space-y-2">
                {group.findings.slice(0, 60).map((finding, i) => (
                  <li key={`${finding.href}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-step--1">
                    <Link href={finding.href} className="font-bold text-primary hover:underline">
                      {finding.label}
                    </Link>
                    <span className="font-mono text-subtle">{finding.href}</span>
                    <span className="text-muted">{finding.detail}</span>
                  </li>
                ))}
                {group.findings.length > 60 ? (
                  <li className="text-step--1 text-subtle">…and {group.findings.length - 60} more.</li>
                ) : null}
              </ul>
            )}
          </Panel>
        ))}
      </div>
    </>
  )
}

/** Pulls every string that looks like a URL out of a block's props tree. */
function collectUrls(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) collectUrls(child, found)
    return found
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (typeof value === 'string' && (key === 'url' || key === 'href') && value.trim()) {
        found.push(value.trim())
      } else {
        collectUrls(value, found)
      }
    }
  }
  return found
}
