import 'server-only'
import type { EntityType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/settings'
import { absoluteUrl } from '@/lib/utils'

/**
 * JSON-LD generation.
 *
 * Rules enforced here:
 *   - no empty or null properties are ever emitted (see prune())
 *   - Review is nested on Organization only where a real named review exists
 *   - AggregateRating is never synthesised from those reviews
 *   - a per-entity SchemaOverride can augment or fully replace the graph
 */

type Json = Record<string, unknown>

/** Drops undefined, null, '' and empty arrays/objects, recursively. */
export function prune<T>(value: T): T {
  if (Array.isArray(value)) {
    const cleaned = value.map(prune).filter((v) => v !== undefined && v !== null && v !== '')
    return (cleaned.length ? cleaned : undefined) as T
  }
  if (value && typeof value === 'object') {
    const out: Json = {}
    for (const [key, raw] of Object.entries(value as Json)) {
      const cleaned = prune(raw)
      if (cleaned === undefined || cleaned === null || cleaned === '') continue
      out[key] = cleaned
    }
    return (Object.keys(out).length ? out : undefined) as T
  }
  return value
}

/**
 * E.164-with-separators, the form Google's docs use.
 *
 * The two business nodes used to format the same number two different ways —
 * "+1-855-734-5700" on Organization and "+1-8557345700" on LocalBusiness —
 * because each rebuilt the string itself and only one applied the grouping.
 */
function telephone(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^1/, '')
  return `+1-${digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}`
}

export async function organizationNode(): Promise<Json> {
  const { organization, branding, seo } = await getSettings()

  // Only reviews that exist with a real named author are attached.
  const testimonials = await prisma.testimonial
    .findMany({ where: { status: 'PUBLISHED' }, orderBy: { order: 'asc' }, take: 8 })
    .catch(() => [])

  return {
    '@type': 'Organization',
    '@id': `${absoluteUrl('/')}#organization`,
    name: organization.name,
    legalName: organization.legalName,
    description: organization.description,
    url: absoluteUrl('/'),
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl(branding.footerLogo.src),
      width: branding.footerLogo.width,
      height: branding.footerLogo.height,
    },
    image: absoluteUrl(seo.defaultOgImage || branding.defaultOgImage),
    telephone: telephone(organization.phone),
    email: organization.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: organization.streetAddress,
      addressLocality: organization.addressLocality,
      addressRegion: organization.addressRegion,
      postalCode: organization.postalCode,
      addressCountry: organization.addressCountry,
    },
    areaServed: { '@type': 'Country', name: 'United States' },
    sameAs: organization.sameAs.map((s) => s.url).filter(Boolean),
    // No aggregateRating: the business has no verified rating count to publish.
    review: testimonials.map((t) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: t.name },
      reviewBody: t.quote,
      reviewRating: { '@type': 'Rating', ratingValue: t.rating, bestRating: 5, worstRating: 1 },
    })),
  }
}

export async function localBusinessNode(): Promise<Json> {
  const { organization, branding } = await getSettings()
  return {
    '@type': 'LocalBusiness',
    '@id': `${absoluteUrl('/')}#localbusiness`,
    name: organization.name,
    image: absoluteUrl(branding.defaultOgImage),
    url: absoluteUrl('/'),
    telephone: telephone(organization.phone),
    email: organization.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: organization.streetAddress,
      addressLocality: organization.addressLocality,
      addressRegion: organization.addressRegion,
      postalCode: organization.postalCode,
      addressCountry: organization.addressCountry,
    },
    geo:
      organization.latitude !== null && organization.longitude !== null
        ? { '@type': 'GeoCoordinates', latitude: organization.latitude, longitude: organization.longitude }
        : undefined,
    openingHours: organization.openingHours,
    parentOrganization: { '@id': `${absoluteUrl('/')}#organization` },
  }
}

export async function webSiteNode(): Promise<Json> {
  const { seo } = await getSettings()
  return {
    '@type': 'WebSite',
    '@id': `${absoluteUrl('/')}#website`,
    name: seo.siteName,
    url: absoluteUrl('/'),
    description: seo.defaultDescription,
    publisher: { '@id': `${absoluteUrl('/')}#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${absoluteUrl('/guides')}?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function breadcrumbNode(trail: { name: string; url: string }[]): Json {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.url),
    })),
  }
}

export function faqNode(items: { question: string; answer: string }[]): Json | undefined {
  if (!items.length) return undefined
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

/**
 * Service node for a service or city page.
 *
 * `areaServed` is the point of the city pages — without it every one of them
 * described the same nationwide service and nothing distinguished Miami from
 * Seattle. When a city is given the node names that city; otherwise it falls
 * back to the country.
 *
 * `providerMobility: dynamic` is the correct signal for a service-area
 * business: the coaches travel to the customer, there is no branch office in
 * each city, and claiming one would be false.
 *
 * The offer catalogue lists the real coach classes. No price is attached
 * anywhere — every coach has a null rate because the business publishes only a
 * quote-on-request band, and inventing a figure here would put a price in
 * search results that nobody agreed to honour.
 */
export async function serviceNode(input: {
  name: string
  description: string
  serviceType: string
  route: string
  city?: { name: string; state: string } | null
}): Promise<Json> {
  const classes = await prisma.coachClass
    .findMany({ orderBy: { order: 'asc' }, select: { name: true, slug: true, description: true } })
    .catch(() => [])

  return {
    '@type': 'Service',
    '@id': `${absoluteUrl(input.route)}#service`,
    name: input.name,
    serviceType: input.serviceType,
    description: input.description,
    url: absoluteUrl(input.route),
    provider: { '@id': `${absoluteUrl('/')}#organization` },
    providerMobility: 'dynamic',
    areaServed: input.city
      ? {
          '@type': 'City',
          name: `${input.city.name}, ${input.city.state}`,
          address: {
            '@type': 'PostalAddress',
            addressLocality: input.city.name,
            addressRegion: input.city.state,
            addressCountry: 'US',
          },
        }
      : { '@type': 'Country', name: 'United States' },
    hasOfferCatalog: classes.length
      ? {
          '@type': 'OfferCatalog',
          name: 'Coach classes',
          itemListElement: classes.map((coachClass) => ({
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: `${coachClass.name} class entertainer coach`,
              description: coachClass.description ?? undefined,
              url: absoluteUrl(`/fleet?class=${coachClass.slug}`),
            },
          })),
        }
      : undefined,
  }
}

/** Product/Vehicle for a coach detail page. Offers omit price when none is set. */
export function coachNode(coach: {
  name: string
  slug: string
  description: string
  chassis: string
  bunks: number
  slideOuts: string
  rearConfig: string
  dailyPrice: number | null
  currency: string
  available: boolean
  className: string | null
  images: string[]
}): Json {
  return {
    '@type': ['Product', 'Vehicle'],
    name: coach.name,
    description: coach.description,
    url: absoluteUrl(`/fleet/${coach.slug}`),
    image: coach.images.map((src) => absoluteUrl(src)),
    brand: { '@type': 'Brand', name: 'Prevost' },
    vehicleConfiguration: coach.chassis,
    category: coach.className ?? undefined,
    numberOfBedsTotal: coach.bunks,
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Chassis', value: coach.chassis },
      { '@type': 'PropertyValue', name: 'Bunks', value: String(coach.bunks) },
      { '@type': 'PropertyValue', name: 'Slide-outs', value: coach.slideOuts },
      { '@type': 'PropertyValue', name: 'Rear configuration', value: coach.rearConfig },
    ],
    offers:
      coach.dailyPrice !== null
        ? {
            '@type': 'Offer',
            price: coach.dailyPrice,
            priceCurrency: coach.currency,
            unitText: 'DAY',
            availability: coach.available
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            url: absoluteUrl(`/fleet/${coach.slug}`),
            seller: { '@id': `${absoluteUrl('/')}#organization` },
          }
        : undefined,
  }
}

export function blogPostingNode(post: {
  title: string
  slug: string
  description: string
  image: string | null
  publishedAt: Date | null
  updatedAt: Date
  authorName: string | null
  /** Category name, emitted as articleSection. */
  section?: string | null
  /** Rendered article HTML, used only to count words. */
  body?: string | null
}): Json {
  // Word count from the rendered text, not the markup, so tags and attributes
  // are not counted as words.
  const words = post.body
    ? post.body
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .split(/\s+/)
        .filter(Boolean).length
    : undefined

  return {
    '@type': 'BlogPosting',
    '@id': `${absoluteUrl(`/guides/${post.slug}`)}#article`,
    headline: post.title,
    description: post.description,
    url: absoluteUrl(`/guides/${post.slug}`),
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(`/guides/${post.slug}`) },
    image: post.image ? absoluteUrl(post.image) : undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: post.authorName ? { '@type': 'Person', name: post.authorName } : { '@id': `${absoluteUrl('/')}#organization` },
    publisher: { '@id': `${absoluteUrl('/')}#organization` },
    // Ties the article to the blog it belongs to, so the guides index and the
    // articles under it read as one collection rather than unrelated pages.
    isPartOf: { '@id': `${absoluteUrl('/guides')}#blog` },
    articleSection: post.section ?? undefined,
    wordCount: words,
    inLanguage: 'en-US',
  }
}

/**
 * The guides index as a Blog rather than a bare CollectionPage, with its posts
 * listed in order. Every entry points at a URL that exists; nothing is
 * summarised here that is not published.
 */
export function blogNode(input: {
  name: string
  description: string
  posts: { title: string; slug: string; publishedAt: Date | null }[]
}): Json {
  return {
    '@type': 'Blog',
    '@id': `${absoluteUrl('/guides')}#blog`,
    name: input.name,
    description: input.description,
    url: absoluteUrl('/guides'),
    publisher: { '@id': `${absoluteUrl('/')}#organization` },
    inLanguage: 'en-US',
    blogPost: input.posts.map((p) => ({
      '@type': 'BlogPosting',
      '@id': `${absoluteUrl(`/guides/${p.slug}`)}#article`,
      headline: p.title,
      url: absoluteUrl(`/guides/${p.slug}`),
      datePublished: p.publishedAt?.toISOString(),
    })),
  }
}

/**
 * An ordered list of the things a listing page lists.
 *
 * /fleet previously emitted a CollectionPage that named no members, so nothing
 * connected the page to the twenty-one coach pages under it.
 */
export function itemListNode(input: { route: string; items: { name: string; url: string }[] }): Json | undefined {
  if (!input.items.length) return undefined
  return {
    '@type': 'ItemList',
    '@id': `${absoluteUrl(input.route)}#list`,
    numberOfItems: input.items.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: input.items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: absoluteUrl(item.url),
    })),
  }
}

export function webPageNode(input: {
  type: 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage'
  name: string
  description: string
  route: string
}): Json {
  return {
    '@type': input.type,
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.route),
    isPartOf: { '@id': `${absoluteUrl('/')}#website` },
    about: { '@id': `${absoluteUrl('/')}#organization` },
  }
}

/**
 * Assembles the final @graph for a page, applying any per-entity override, and
 * returns the script tag payload. Returns null when there is nothing to emit.
 */
export async function buildGraph(
  nodes: (Json | undefined)[],
  entity?: { type: EntityType; id: string },
): Promise<string | null> {
  let graph = nodes.filter(Boolean) as Json[]

  if (entity) {
    const override = await prisma.schemaOverride
      .findUnique({ where: { entityType_entityId: { entityType: entity.type, entityId: entity.id } } })
      .catch(() => null)

    if (override?.enabled) {
      const custom = override.jsonLd as Json | Json[]
      const customNodes = Array.isArray(custom) ? custom : [custom]
      graph = override.replace ? customNodes : [...graph, ...customNodes]
    }
  }

  const cleaned = prune(graph) as Json[] | undefined
  if (!cleaned || !cleaned.length) return null
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': cleaned })
}
