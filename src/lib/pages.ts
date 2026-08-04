import 'server-only'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { normalizeRoute } from '@/lib/utils'
import type { StoredBlock } from '@/components/blocks'

export interface LoadedPage {
  id: string
  path: string
  slug: string
  title: string
  pageType: string
  customCss: string | null
  heroImage: string | null
  publishedAt: Date | null
  updatedAt: Date
  blocks: StoredBlock[]
}

async function loadPage(path: string): Promise<LoadedPage | null> {
  try {
    const page = await prisma.page.findUnique({
      where: { path },
      include: {
        heroImage: true,
        blocks: { orderBy: { order: 'asc' } },
      },
    })
    if (!page || page.status !== 'PUBLISHED') return null
    return {
      id: page.id,
      path: page.path,
      slug: page.slug,
      title: page.title,
      pageType: page.pageType,
      customCss: page.customCss,
      heroImage: page.heroImage?.path ?? null,
      publishedAt: page.publishedAt,
      updatedAt: page.updatedAt,
      blocks: page.blocks.map((b) => ({
        id: b.id,
        type: b.type,
        order: b.order,
        visible: b.visible,
        props: b.props,
      })),
    }
  } catch {
    // A database outage must not turn every URL into a 500 during build.
    return null
  }
}

export const getPage = (rawPath: string) => {
  const path = normalizeRoute(rawPath)
  return unstable_cache(() => loadPage(path), ['page', path], {
    tags: ['pages', `page:${path}`],
    revalidate: 300,
  })()
}

export async function getPublishedPagePaths(): Promise<string[]> {
  try {
    const pages = await prisma.page.findMany({
      where: { status: 'PUBLISHED' },
      select: { path: true },
      orderBy: { path: 'asc' },
    })
    return pages.map((p) => p.path)
  } catch {
    return []
  }
}

/** Breadcrumb trail derived from the route, using real page titles where they exist. */
export async function breadcrumbsFor(path: string, leafTitle: string): Promise<{ name: string; url: string }[]> {
  const trail: { name: string; url: string }[] = [{ name: 'Home', url: '/' }]
  if (path === '/') return trail

  const segments = path.split('/').filter(Boolean)
  const accumulated: string[] = []

  for (let i = 0; i < segments.length; i += 1) {
    accumulated.push(segments[i])
    const url = `/${accumulated.join('/')}`
    const isLeaf = i === segments.length - 1
    if (isLeaf) {
      trail.push({ name: leafTitle, url })
      continue
    }
    const parent = await prisma.page.findUnique({ where: { path: url }, select: { title: true } }).catch(() => null)
    trail.push({
      name: parent?.title ?? segments[i].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      url,
    })
  }
  return trail
}
