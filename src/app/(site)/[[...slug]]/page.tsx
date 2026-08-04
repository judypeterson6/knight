import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getPage, breadcrumbsFor } from '@/lib/pages'
import { buildMetadata } from '@/lib/seo'
import {
  breadcrumbNode,
  buildGraph,
  faqNode,
  localBusinessNode,
  organizationNode,
  serviceNode,
  webPageNode,
  webSiteNode,
} from '@/lib/schema-org'
import { getSettings } from '@/lib/settings'
import { normalizeRoute } from '@/lib/utils'
import { BlockRenderer } from '@/components/blocks'
import { JsonLd } from '@/components/seo/json-ld'

/**
 * Every database-backed page renders through here: the homepage, the service
 * pages, /fleet, the 20 city pages, the 12 audience pages, /contact-us and the
 * legal pages.
 *
 * ISR: pages revalidate on a timer and are invalidated on save through
 * revalidateTag('page:<path>'). There is no force-dynamic on any public route.
 */
export const revalidate = 300
export const dynamicParams = true

type Params = { slug?: string[] }
type Props = {
  params: Promise<Params>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function routeFrom(slug: string[] | undefined): string {
  return normalizeRoute(`/${(slug ?? []).join('/')}`)
}

export async function generateStaticParams(): Promise<Params[]> {
  try {
    const pages = await prisma.page.findMany({ where: { status: 'PUBLISHED' }, select: { path: true } })
    return pages.map((page) => ({
      slug: page.path === '/' ? [] : page.path.split('/').filter(Boolean),
    }))
  } catch {
    // Without a reachable database at build time, every route renders on demand.
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const route = routeFrom((await params).slug)
  const page = await getPage(route)
  if (!page) return { title: 'Page not found' }

  return buildMetadata({
    entityType: 'PAGE',
    entityId: page.id,
    route: page.path,
    fallbackTitle: page.title,
    fallbackImage: page.heroImage,
  })
}

export default async function DynamicPage({ params, searchParams }: Props) {
  const route = routeFrom((await params).slug)
  const query = await searchParams
  const page = await getPage(route)
  if (!page) notFound()

  const [{ seo }, trail] = await Promise.all([getSettings(), breadcrumbsFor(page.path, page.title)])

  // FAQ groups on this page feed FAQPage schema straight from the same rows the
  // accordion renders, so the markup and the structured data cannot drift apart.
  const faqGroups = page.blocks
    .filter((b) => b.visible && b.type === 'FaqAccordion')
    .map((b) => (b.props as { group?: string }).group)
    .filter((g): g is string => Boolean(g))

  const faqs = faqGroups.length
    ? await prisma.faqItem
        .findMany({
          where: { group: { in: faqGroups }, status: 'PUBLISHED' },
          orderBy: { order: 'asc' },
          select: { question: true, answer: true },
        })
        .catch(() => [])
    : []

  const description = seo.defaultDescription
  const pageNodes = []

  if (page.pageType === 'home') {
    pageNodes.push(await webSiteNode(), await localBusinessNode())
  }
  if (page.pageType === 'about') {
    pageNodes.push(webPageNode({ type: 'AboutPage', name: page.title, description, route: page.path }))
  } else if (page.pageType === 'contact') {
    pageNodes.push(
      webPageNode({ type: 'ContactPage', name: page.title, description, route: page.path }),
      await localBusinessNode(),
    )
  } else if (page.pageType === 'service' || page.pageType === 'location') {
    pageNodes.push(
      await serviceNode({
        name: page.title,
        description,
        serviceType: 'Entertainer coach and tour bus rental',
        route: page.path,
      }),
    )
  } else if (page.pageType === 'fleet-listing') {
    pageNodes.push(webPageNode({ type: 'CollectionPage', name: page.title, description, route: page.path }))
  } else {
    pageNodes.push(webPageNode({ type: 'WebPage', name: page.title, description, route: page.path }))
  }

  const graph = await buildGraph(
    [await organizationNode(), ...pageNodes, breadcrumbNode(trail), faqNode(faqs)],
    { type: 'PAGE', id: page.id },
  )

  return (
    <>
      {page.customCss ? <style dangerouslySetInnerHTML={{ __html: page.customCss }} /> : null}
      <JsonLd data={graph} />
      <BlockRenderer blocks={page.blocks} ctx={{ route: page.path, searchParams: query }} />
    </>
  )
}
