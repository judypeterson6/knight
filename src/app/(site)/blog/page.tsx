import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/settings'
import { excerptFrom, formatDate, isoDate, readingMinutes } from '@/lib/utils'
import { buildGraph, breadcrumbNode, organizationNode, webPageNode } from '@/lib/schema-org'
import { JsonLd } from '@/components/seo/json-ld'
import { Card, Section, SectionHeading, SmartImage, SmartLink } from '@/components/ui/primitives'

export const revalidate = 300

const PER_PAGE = 9

type Props = { searchParams: Promise<{ page?: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getSettings()
  return {
    title: `Touring Guides | ${seo.siteName}`,
    description:
      'Practical guides on routing tours around coach drive times, bus call and day sheets, entertainer coach age and mileage, and life on the road.',
    alternates: { canonical: '/blog' },
  }
}

export default async function BlogArchive({ searchParams }: Props) {
  const { page: pageParam } = await searchParams
  const current = Math.max(1, Number(pageParam) || 1)

  const [posts, total, categories] = await Promise.all([
    prisma.post
      .findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        skip: (current - 1) * PER_PAGE,
        take: PER_PAGE,
        include: { featuredImage: true, category: true, author: true },
      })
      .catch(() => []),
    prisma.post.count({ where: { status: 'PUBLISHED' } }).catch(() => 0),
    prisma.category.findMany({ orderBy: { order: 'asc' } }).catch(() => []),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  const graph = await buildGraph([
    await organizationNode(),
    webPageNode({
      type: 'CollectionPage',
      name: 'Touring guides',
      description: 'Guides on touring logistics, coach specification and life on the road.',
      route: '/blog',
    }),
    breadcrumbNode([
      { name: 'Home', url: '/' },
      { name: 'Blog', url: '/blog' },
    ]),
  ])

  return (
    <>
      <JsonLd data={graph} />

      <Section base={{ background: 'surface', spacing: 'md', align: 'left', anchor: '', className: 'pt-32 md:pt-36' }}>
        <SectionHeading
          eyebrow="Touring guides"
          heading="Guides for tour managers and touring crews"
          level="h1"
          body="How routing, bus call, coach specification and overnight travel actually work — written for the people who run the tour."
          className="max-w-3xl"
        />

        {categories.length ? (
          <nav aria-label="Blog categories" className="mt-8">
            <ul className="flex flex-wrap gap-3">
              {categories.map((category) => (
                <li key={category.id}>
                  <SmartLink
                    href={`/blog/category/${category.slug}`}
                    className="rounded-pill border border-line px-4 py-2 text-step--1 font-bold transition hover:border-primary hover:text-primary"
                  >
                    {category.name}
                  </SmartLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {posts.length === 0 ? (
          <p className="mt-12 rounded-card border border-line bg-surface-alt p-8 text-muted">
            No posts published yet.
          </p>
        ) : (
          <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Card key={post.id} as="li" className="overflow-hidden">
                <article>
                  <SmartLink href={`/blog/${post.slug}`}>
                    {post.featuredImage ? (
                      <SmartImage
                        image={{
                          src: post.featuredImage.path,
                          alt: post.featuredImage.alt || post.title,
                          width: post.featuredImage.width ?? 800,
                          height: post.featuredImage.height ?? 500,
                          caption: '',
                          decorative: false,
                        }}
                        className="h-52 w-full object-cover"
                        sizes="(max-width: 640px) 100vw, 33vw"
                      />
                    ) : null}
                  </SmartLink>
                  <div className="p-6">
                    {post.category ? (
                      <SmartLink
                        href={`/blog/category/${post.category.slug}`}
                        className="text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-primary"
                      >
                        {post.category.name}
                      </SmartLink>
                    ) : null}
                    <h2 className="mt-2 text-step-2">
                      <SmartLink href={`/blog/${post.slug}`} className="hover:text-primary">
                        {post.title}
                      </SmartLink>
                    </h2>
                    <p className="mt-3 text-step--1 leading-relaxed text-muted">
                      {post.excerpt || excerptFrom(post.body, 150)}
                    </p>
                    <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-step--1 text-subtle">
                      {post.publishedAt ? (
                        <time dateTime={isoDate(post.publishedAt)}>{formatDate(post.publishedAt)}</time>
                      ) : null}
                      <span aria-hidden>·</span>
                      <span>{readingMinutes(post.body)} min read</span>
                    </p>
                  </div>
                </article>
              </Card>
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-3">
            {current > 1 ? (
              <SmartLink href={current === 2 ? '/blog' : `/blog?page=${current - 1}`} className="kc-btn kc-btn-outline">
                Previous
              </SmartLink>
            ) : null}
            <p className="text-step--1 text-muted">
              Page {current} of {totalPages}
            </p>
            {current < totalPages ? (
              <SmartLink href={`/blog?page=${current + 1}`} className="kc-btn kc-btn-outline">
                Next
              </SmartLink>
            ) : null}
          </nav>
        ) : null}
      </Section>
    </>
  )
}
