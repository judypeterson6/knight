import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/settings'
import { publishedWhere } from '@/lib/publish'
import { absoluteUrl } from '@/lib/utils'

export const runtime = 'nodejs'
export const revalidate = 3600

/**
 * /llms.txt
 *
 * A Markdown index of the site for large language models, per llmstxt.org.
 * The spec requires an H1 as the first line, an optional blockquote summary,
 * then H2 sections of links.
 *
 * Generated from the database rather than written by hand, so a page added in
 * /admin appears here without anyone remembering to update a static file. The
 * same publish rules the sitemap uses apply, so drafts and scheduled pages
 * stay out until they are actually live.
 */
export async function GET(): Promise<Response> {
  const { organization, seo } = await getSettings()

  const [pages, posts, coaches] = await Promise.all([
    prisma.page
      .findMany({
        where: publishedWhere(),
        orderBy: { path: 'asc' },
        select: { path: true, title: true },
      })
      .catch(() => []),
    prisma.post
      .findMany({
        where: publishedWhere(),
        orderBy: { publishedAt: 'desc' },
        take: 50,
        select: { slug: true, title: true, excerpt: true },
      })
      .catch(() => []),
    prisma.coach
      .findMany({ orderBy: { displayOrder: 'asc' }, select: { slug: true, name: true, chassis: true } })
      .catch(() => []),
  ])

  const line = (title: string, url: string, note?: string) =>
    `- [${title}](${absoluteUrl(url)})${note ? `: ${note}` : ''}`

  const body = [
    `# ${organization.name}`,
    '',
    `> ${organization.description}`,
    '',
    `${organization.name} leases Prevost entertainer coaches with CDL drivers across the continental United States. Contact: ${organization.email}, ${organization.phone}.`,
    '',
    '## Pages',
    ...pages.map((p) => line(p.title, p.path)),
    '',
    '## Fleet',
    ...coaches.map((c) => line(c.name, `/fleet/${c.slug}`, c.chassis)),
    '',
    '## Guides',
    ...posts.map((p) => line(p.title, `/guides/${p.slug}`, p.excerpt?.slice(0, 120) || undefined)),
    '',
    '## Optional',
    line('Sitemap index', '/sitemap.xml'),
    line('Robots', '/robots.txt'),
    '',
    `Site: ${seo.siteName}. Content is factual operator information; figures quoted as market ranges are attributed on the page they appear.`,
    '',
  ].join('\n')

  return new Response(body, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
