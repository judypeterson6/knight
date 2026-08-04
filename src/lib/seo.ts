import 'server-only'
import type { Metadata } from 'next'
import type { EntityType, RobotsDirective, SeoMeta } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/settings'
import { absoluteUrl } from '@/lib/utils'

/**
 * Per-URL SEO.
 *
 * There is deliberately no keywords field anywhere in this file, in the schema,
 * or in the admin UI — meta keywords is a deprecated signal and emitting it
 * would be noise.
 */

export async function getSeoMeta(entityType: EntityType, entityId: string): Promise<SeoMeta | null> {
  try {
    return await prisma.seoMeta.findUnique({ where: { entityType_entityId: { entityType, entityId } } })
  } catch {
    return null
  }
}

function robotsFor(directive: RobotsDirective | undefined): Metadata['robots'] {
  const index = directive !== 'NOINDEX_FOLLOW' && directive !== 'NOINDEX_NOFOLLOW'
  const follow = directive !== 'INDEX_NOFOLLOW' && directive !== 'NOINDEX_NOFOLLOW'
  return {
    index,
    follow,
    googleBot: { index, follow, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  }
}

export interface MetadataInput {
  entityType: EntityType
  entityId: string
  /** Route path used for the canonical when no override exists. */
  route: string
  fallbackTitle: string
  fallbackDescription?: string | null
  fallbackImage?: string | null
  type?: 'website' | 'article'
  publishedTime?: Date | null
  modifiedTime?: Date | null
  authorName?: string | null
}

export async function buildMetadata(input: MetadataInput): Promise<Metadata> {
  const [{ seo, branding, organization }, override] = await Promise.all([
    getSettings(),
    getSeoMeta(input.entityType, input.entityId),
  ])

  const rawTitle = override?.title?.trim() || input.fallbackTitle
  // The template is applied only when the page has not supplied its own full title.
  const title = override?.title?.trim()
    ? rawTitle
    : seo.titleTemplate.replace('%page%', rawTitle).replace('%site%', seo.siteName)

  const description =
    override?.description?.trim() || input.fallbackDescription?.trim() || seo.defaultDescription

  const canonicalPath = override?.canonical?.trim() || input.route
  const canonical = canonicalPath.startsWith('http') ? canonicalPath : absoluteUrl(canonicalPath)

  const imagePath =
    override?.ogImage?.trim() || input.fallbackImage || seo.defaultOgImage || branding.defaultOgImage
  const image = imagePath.startsWith('http') ? imagePath : absoluteUrl(imagePath)

  return {
    title,
    description,
    alternates: { canonical },
    robots: robotsFor(override?.robots),
    openGraph: {
      type: input.type ?? 'website',
      siteName: seo.siteName,
      title: override?.ogTitle?.trim() || title,
      description: override?.ogDescription?.trim() || description,
      url: canonical,
      locale: 'en_US',
      images: [{ url: image, alt: rawTitle }],
      ...(input.type === 'article'
        ? {
            publishedTime: input.publishedTime?.toISOString(),
            modifiedTime: input.modifiedTime?.toISOString(),
            authors: input.authorName ? [input.authorName] : undefined,
          }
        : {}),
    },
    twitter: {
      card: (seo.twitterCard as 'summary_large_image') || 'summary_large_image',
      site: seo.twitterSite || undefined,
      title: override?.ogTitle?.trim() || title,
      description: override?.ogDescription?.trim() || description,
      images: [image],
    },
    other: {
      'geo.region': `${organization.addressCountry}-${organization.addressRegion}`,
      'geo.placename': organization.addressLocality,
    },
  }
}
