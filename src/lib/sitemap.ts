import 'server-only'
import { publishedPageWhere, publishedPostWhere, publishedCoachWhere } from '@/lib/publish'
import { prisma } from '@/lib/prisma'
import { absoluteUrl } from '@/lib/utils'

/**
 * Sitemap generation.
 *
 * The index at /sitemap.xml points at one child per content type. Per-item
 * exclusion is honoured through SeoMeta.sitemapExclude, and priority /
 * changefreq fall back to type defaults when no override is set.
 */

export type SitemapType = 'pages' | 'posts' | 'categories' | 'fleet'

export const SITEMAP_TYPES: SitemapType[] = ['pages', 'posts', 'categories', 'fleet']

export interface SitemapEntry {
  loc: string
  lastmod: string
  changefreq: string
  priority: string
}

const DEFAULTS: Record<SitemapType, { changefreq: string; priority: number }> = {
  pages: { changefreq: 'weekly', priority: 0.8 },
  posts: { changefreq: 'monthly', priority: 0.6 },
  categories: { changefreq: 'monthly', priority: 0.4 },
  fleet: { changefreq: 'weekly', priority: 0.7 },
}

async function excludedIds(entityType: 'PAGE' | 'POST' | 'CATEGORY' | 'COACH'): Promise<Map<string, { priority: number | null; changefreq: string | null; excluded: boolean }>> {
  const map = new Map<string, { priority: number | null; changefreq: string | null; excluded: boolean }>()
  try {
    const rows = await prisma.seoMeta.findMany({
      where: { entityType },
      select: { entityId: true, sitemapExclude: true, sitemapPriority: true, sitemapChangefreq: true, robots: true },
    })
    for (const row of rows) {
      map.set(row.entityId, {
        priority: row.sitemapPriority,
        changefreq: row.sitemapChangefreq,
        // A noindex page never belongs in the sitemap either.
        excluded: row.sitemapExclude || row.robots === 'NOINDEX_FOLLOW' || row.robots === 'NOINDEX_NOFOLLOW',
      })
    }
  } catch {
    /* no overrides available */
  }
  return map
}

function entry(
  type: SitemapType,
  loc: string,
  lastmod: Date,
  override?: { priority: number | null; changefreq: string | null },
  boost = 0,
): SitemapEntry {
  const base = DEFAULTS[type]
  return {
    loc: absoluteUrl(loc),
    lastmod: lastmod.toISOString(),
    changefreq: override?.changefreq ?? base.changefreq,
    priority: (override?.priority ?? Math.min(1, base.priority + boost)).toFixed(1),
  }
}

export async function sitemapEntries(type: SitemapType): Promise<SitemapEntry[]> {
  try {
    if (type === 'pages') {
      const [pages, overrides] = await Promise.all([
        prisma.page.findMany({
          where: publishedPageWhere(),
          select: { id: true, path: true, updatedAt: true },
          orderBy: { path: 'asc' },
        }),
        excludedIds('PAGE'),
      ])
      return pages
        .filter((page) => !overrides.get(page.id)?.excluded)
        .map((page) =>
          // The homepage and the top-level service pages carry the highest priority.
          entry(
            'pages',
            page.path,
            page.updatedAt,
            overrides.get(page.id),
            page.path === '/' ? 0.2 : page.path.split('/').filter(Boolean).length === 1 ? 0.1 : 0,
          ),
        )
    }

    if (type === 'posts') {
      const [posts, overrides] = await Promise.all([
        prisma.post.findMany({
          where: publishedPostWhere(),
          select: { id: true, slug: true, updatedAt: true },
          orderBy: { publishedAt: 'desc' },
        }),
        excludedIds('POST'),
      ])
      return posts
        .filter((post) => !overrides.get(post.id)?.excluded)
        .map((post) => entry('posts', `/blog/${post.slug}`, post.updatedAt, overrides.get(post.id)))
    }

    if (type === 'categories') {
      const [categories, overrides] = await Promise.all([
        prisma.category.findMany({ select: { id: true, slug: true, updatedAt: true }, orderBy: { order: 'asc' } }),
        excludedIds('CATEGORY'),
      ])
      return categories
        .filter((category) => !overrides.get(category.id)?.excluded)
        .map((category) =>
          entry('categories', `/blog/category/${category.slug}`, category.updatedAt, overrides.get(category.id)),
        )
    }

    const [coaches, overrides] = await Promise.all([
      prisma.coach.findMany({
        where: publishedCoachWhere(),
        select: { id: true, slug: true, updatedAt: true },
        orderBy: { displayOrder: 'asc' },
      }),
      excludedIds('COACH'),
    ])
    return coaches
      .filter((coach) => !overrides.get(coach.id)?.excluded)
      .map((coach) => entry('fleet', `/fleet/${coach.slug}`, coach.updatedAt, overrides.get(coach.id)))
  } catch {
    return []
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function urlsetXml(entries: SitemapEntry[]): string {
  const body = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${escapeXml(e.loc)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

export async function sitemapIndexXml(): Promise<string> {
  const children = await Promise.all(
    SITEMAP_TYPES.map(async (type) => {
      const entries = await sitemapEntries(type)
      if (!entries.length) return null
      const lastmod = entries.reduce((latest, e) => (e.lastmod > latest ? e.lastmod : latest), entries[0].lastmod)
      return `  <sitemap>\n    <loc>${escapeXml(absoluteUrl(`/sitemap-${type}.xml`))}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`
    }),
  )
  const body = children.filter(Boolean).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`
}

export const XML_HEADERS = {
  'content-type': 'application/xml; charset=utf-8',
  'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
}
