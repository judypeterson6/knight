import type { Metadata } from 'next'
import { publishedCoachWhere, publishedPageWhere } from '@/lib/publish'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getPage, breadcrumbsFor } from '@/lib/pages'
import { buildMetadata } from '@/lib/seo'
import {
  breadcrumbNode,
  buildGraph,
  faqNode,
  itemListNode,
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
    const pages = await prisma.page.findMany({ where: publishedPageWhere(), select: { path: true } })
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
    // A city page describes the service *in that city*. Without areaServed
    // every one of the 22 city pages emitted an identical nationwide Service
    // and nothing told Miami apart from Seattle.
    const city =
      page.pageType === 'location'
        ? await prisma.location
            .findUnique({ where: { path: page.path }, select: { city: true, state: true } })
            .catch(() => null)
        : null

    pageNodes.push(
      await serviceNode({
        name: page.title,
        description,
        serviceType: 'Entertainer coach and tour bus rental',
        route: page.path,
        city: city ? { name: city.city, state: city.state } : null,
      }),
      // The one real premises, linked by @id. Coaches travel out from it; no
      // branch is claimed in any city — that is what providerMobility says.
      await localBusinessNode(),
    )
  } else if (page.pageType === 'fleet-listing') {
    // The CollectionPage named no members, so nothing tied this page to the
    // coach pages beneath it. The list is built from the fleet itself, so it
    // cannot drift from what the page actually shows.
    const coaches = await prisma.coach
      .findMany({
        where: publishedCoachWhere(),
        orderBy: [{ featured: 'desc' }, { displayOrder: 'asc' }],
        select: { name: true, slug: true },
      })
      .catch(() => [])

    pageNodes.push(
      webPageNode({ type: 'CollectionPage', name: page.title, description, route: page.path }),
      itemListNode({ route: page.path, items: coaches.map((c) => ({ name: c.name, url: `/fleet/${c.slug}` })) }),
    )
  } else if (page.pageType === 'reviews') {
    // Not a Service. The reviews themselves already hang off the Organization
    // node, which is what a rich result reads.
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
