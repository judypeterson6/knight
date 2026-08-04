import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { Section, SectionHeading, SmartLink } from '@/components/ui/primitives'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Sitemap',
  description: 'Every page on knightscoaches.com, grouped by section.',
  alternates: { canonical: '/sitemap' },
}

/**
 * Human-readable sitemap, generated from the same rows as /sitemap.xml.
 * Doubles as an internal-link mesh for the city and audience pages.
 */
export default async function HtmlSitemap() {
  const [pages, coaches, posts, categories] = await Promise.all([
    prisma.page
      .findMany({ where: { status: 'PUBLISHED' }, select: { path: true, title: true, pageType: true }, orderBy: { path: 'asc' } })
      .catch(() => []),
    prisma.coach
      .findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, name: true }, orderBy: { displayOrder: 'asc' } })
      .catch(() => []),
    prisma.post
      .findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, title: true }, orderBy: { publishedAt: 'desc' } })
      .catch(() => []),
    prisma.category.findMany({ select: { slug: true, name: true }, orderBy: { order: 'asc' } }).catch(() => []),
  ])

  const groups: { heading: string; links: { href: string; label: string }[] }[] = [
    {
      heading: 'Main pages',
      links: pages
        .filter((p) => !p.path.startsWith('/tour-bus-rental/') && !p.path.startsWith('/entertainer-coach/'))
        .map((p) => ({ href: p.path, label: p.title })),
    },
    {
      heading: 'Entertainer coach services',
      links: pages
        .filter((p) => p.path.startsWith('/entertainer-coach/'))
        .map((p) => ({ href: p.path, label: p.title })),
    },
    {
      heading: 'Tour bus rental by city',
      links: pages
        .filter((p) => p.path.startsWith('/tour-bus-rental/'))
        .map((p) => ({ href: p.path, label: p.title })),
    },
    { heading: 'Fleet', links: coaches.map((c) => ({ href: `/fleet/${c.slug}`, label: c.name })) },
    {
      heading: 'Blog categories',
      links: categories.map((c) => ({ href: `/blog/category/${c.slug}`, label: c.name })),
    },
    { heading: 'Guides', links: posts.map((p) => ({ href: `/blog/${p.slug}`, label: p.title })) },
  ].filter((group) => group.links.length > 0)

  return (
    <Section base={{ background: 'surface', spacing: 'md', align: 'left', anchor: '', className: 'pt-32 md:pt-36' }}>
      <SectionHeading
        eyebrow="Sitemap"
        heading="Every page on this site"
        level="h1"
        body="Grouped by section. The machine-readable version lives at /sitemap.xml."
        className="max-w-2xl"
      />

      <div className="mt-14 grid gap-10 md:grid-cols-2">
        {groups.map((group) => (
          <nav key={group.heading} aria-labelledby={`sitemap-${group.heading.replace(/\s+/g, '-').toLowerCase()}`}>
            <h2 id={`sitemap-${group.heading.replace(/\s+/g, '-').toLowerCase()}`} className="text-step-2">
              {group.heading}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <SmartLink
                    href={link.href}
                    className="text-step--1 text-muted underline-offset-4 transition hover:text-primary hover:underline"
                  >
                    {link.label}
                  </SmartLink>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </Section>
  )
}
