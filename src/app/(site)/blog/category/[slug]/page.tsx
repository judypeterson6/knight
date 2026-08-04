import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { buildMetadata } from '@/lib/seo'
import { breadcrumbNode, buildGraph, organizationNode, webPageNode } from '@/lib/schema-org'
import { excerptFrom, formatDate, isoDate, readingMinutes } from '@/lib/utils'
import { JsonLd } from '@/components/seo/json-ld'
import { Card, Section, SectionHeading, SmartImage, SmartLink } from '@/components/ui/primitives'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

async function loadCategory(slug: string) {
  try {
    return await prisma.category.findUnique({ where: { slug } })
  } catch {
    return null
  }
}

export async function generateStaticParams() {
  try {
    const categories = await prisma.category.findMany({ select: { slug: true } })
    return categories.map((c) => ({ slug: c.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = await loadCategory(slug)
  if (!category) return { title: 'Category not found' }

  return buildMetadata({
    entityType: 'CATEGORY',
    entityId: category.id,
    route: `/blog/category/${category.slug}`,
    fallbackTitle: `${category.name} guides`,
    fallbackDescription: category.description || `Guides filed under ${category.name}.`,
  })
}

export default async function CategoryArchive({ params }: Props) {
  const { slug } = await params
  const category = await loadCategory(slug)
  if (!category) notFound()

  const posts = await prisma.post
    .findMany({
      where: { status: 'PUBLISHED', categoryId: category.id },
      orderBy: { publishedAt: 'desc' },
      include: { featuredImage: true },
    })
    .catch(() => [])

  const graph = await buildGraph(
    [
      await organizationNode(),
      webPageNode({
        type: 'CollectionPage',
        name: `${category.name} guides`,
        description: category.description || `Guides filed under ${category.name}.`,
        route: `/blog/category/${category.slug}`,
      }),
      breadcrumbNode([
        { name: 'Home', url: '/' },
        { name: 'Blog', url: '/blog' },
        { name: category.name, url: `/blog/category/${category.slug}` },
      ]),
    ],
    { type: 'CATEGORY', id: category.id },
  )

  return (
    <>
      <JsonLd data={graph} />

      <Section base={{ background: 'surface', spacing: 'md', align: 'left', anchor: '', className: 'pt-32 md:pt-36' }}>
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-2 text-step--1 text-muted">
            <li>
              <SmartLink href="/" className="hover:text-primary">
                Home
              </SmartLink>
            </li>
            <li aria-hidden>/</li>
            <li>
              <SmartLink href="/blog" className="hover:text-primary">
                Blog
              </SmartLink>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="font-semibold text-ink">
              {category.name}
            </li>
          </ol>
        </nav>

        <SectionHeading
          eyebrow="Category"
          heading={`${category.name} guides`}
          level="h1"
          body={category.description || undefined}
          className="max-w-3xl"
        />

        {posts.length === 0 ? (
          <p className="mt-12 rounded-card border border-line bg-surface-alt p-8 text-muted">
            Nothing published in this category yet.{' '}
            <SmartLink href="/blog" className="font-bold text-primary underline">
              Browse all guides
            </SmartLink>
            .
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
                    <h2 className="text-step-2">
                      <SmartLink href={`/blog/${post.slug}`} className="hover:text-primary">
                        {post.title}
                      </SmartLink>
                    </h2>
                    <p className="mt-3 text-step--1 leading-relaxed text-muted">
                      {post.excerpt || excerptFrom(post.body, 150)}
                    </p>
                    <p className="mt-5 flex items-center gap-3 text-step--1 text-subtle">
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
      </Section>
    </>
  )
}
