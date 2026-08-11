import type { Metadata } from 'next'
import { isLive, publishedPostWhere } from '@/lib/publish'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { buildMetadata } from '@/lib/seo'
import { blogPostingNode, breadcrumbNode, buildGraph, organizationNode } from '@/lib/schema-org'
import { excerptFrom, formatDate, isoDate, readingMinutes, sanitizeHtml } from '@/lib/utils'
import { JsonLd } from '@/components/seo/json-ld'
import { Section, SmartImage, SmartLink } from '@/components/ui/primitives'
import { RelatedPostsBlock } from '@/components/blocks/interactive'
import { blockSchemas } from '@/lib/blocks/schema'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

async function loadPost(slug: string) {
  try {
    return await prisma.post.findUnique({
      where: { slug },
      include: { author: true, category: true, featuredImage: true },
    })
  } catch {
    return null
  }
}

export async function generateStaticParams() {
  try {
    const posts = await prisma.post.findMany({ where: publishedPostWhere(), select: { slug: true } })
    return posts.map((p) => ({ slug: p.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await loadPost(slug)
  if (!post || !isLive(post)) return { title: 'Post not found' }

  return buildMetadata({
    entityType: 'POST',
    entityId: post.id,
    route: `/guides/${post.slug}`,
    fallbackTitle: post.title,
    fallbackDescription: post.excerpt || excerptFrom(post.body, 160),
    fallbackImage: post.featuredImage?.path ?? null,
    type: 'article',
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
    authorName: post.author?.name ?? null,
  })
}

/**
 * Blog post.
 *
 * Above the fold: the H1, then the direct answer in the opening sentences —
 * uninterrupted by share buttons, an ad slot, an author box or a newsletter
 * box. Those belong below the answer, and the share row is omitted entirely.
 */
export default async function BlogPost({ params }: Props) {
  const { slug } = await params
  const post = await loadPost(slug)
  if (!post || !isLive(post)) notFound()

  const lede = post.excerpt || excerptFrom(post.body, 320)

  const graph = await buildGraph(
    [
      await organizationNode(),
      blogPostingNode({
        title: post.title,
        slug: post.slug,
        description: lede,
        image: post.featuredImage?.path ?? null,
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
        authorName: post.author?.name ?? null,
      }),
      breadcrumbNode([
        { name: 'Home', url: '/' },
        { name: 'Blog', url: '/guides' },
        ...(post.category ? [{ name: post.category.name, url: `/guides/category/${post.category.slug}` }] : []),
        { name: post.title, url: `/guides/${post.slug}` },
      ]),
    ],
    { type: 'POST', id: post.id },
  )

  return (
    <>
      <JsonLd data={graph} />

      <article>
        <Section base={{ background: 'surface', spacing: 'md', align: 'left', anchor: '', className: 'pt-32 md:pt-36' }}>
          <div className="mx-auto max-w-3xl">
            <nav aria-label="Breadcrumb" className="mb-6">
              <ol className="flex flex-wrap items-center gap-2 text-step--1 text-muted">
                <li>
                  <SmartLink href="/" className="hover:text-primary">
                    Home
                  </SmartLink>
                </li>
                <li aria-hidden>/</li>
                <li>
                  <SmartLink href="/guides" className="hover:text-primary">
                    Blog
                  </SmartLink>
                </li>
                {post.category ? (
                  <>
                    <li aria-hidden>/</li>
                    <li>
                      <SmartLink href={`/guides/category/${post.category.slug}`} className="hover:text-primary">
                        {post.category.name}
                      </SmartLink>
                    </li>
                  </>
                ) : null}
              </ol>
            </nav>

            <h1>{post.title}</h1>

            {/* The direct answer, immediately after the H1. */}
            {lede ? <p className="mt-6 text-step-1 leading-[1.7] text-muted">{lede}</p> : null}

            <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-step--1 text-subtle">
              {post.publishedAt ? (
                <time dateTime={isoDate(post.publishedAt)}>{formatDate(post.publishedAt)}</time>
              ) : null}
              <span aria-hidden>·</span>
              <span>{readingMinutes(post.body)} min read</span>
              {post.author ? (
                <>
                  <span aria-hidden>·</span>
                  <span>By {post.author.name}</span>
                </>
              ) : null}
            </p>
          </div>
        </Section>

        {post.featuredImage ? (
          <Section base={{ background: 'surface', spacing: 'none', align: 'left', anchor: '', className: '' }}>
            <figure className="mx-auto max-w-4xl">
              <SmartImage
                image={{
                  src: post.featuredImage.path,
                  alt: post.featuredImage.alt || post.title,
                  width: post.featuredImage.width ?? 1200,
                  height: post.featuredImage.height ?? 750,
                  caption: '',
                  decorative: false,
                }}
                className="w-full rounded-block object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 60rem"
              />
              {post.featuredImage.caption ? (
                <figcaption className="mt-3 text-step--1 text-subtle">{post.featuredImage.caption}</figcaption>
              ) : null}
            </figure>
          </Section>
        ) : null}

        <Section base={{ background: 'surface', spacing: 'md', align: 'left', anchor: '', className: '' }}>
          <div
            className="kc-prose mx-auto max-w-3xl"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body) }}
          />

          {post.author?.bio ? (
            <aside className="mx-auto mt-14 max-w-3xl rounded-card border border-line bg-surface-alt p-7">
              <h2 className="text-step-1">About {post.author.name}</h2>
              <p className="mt-3 text-step--1 leading-relaxed text-muted">{post.author.bio}</p>
            </aside>
          ) : null}
        </Section>

        <RelatedPostsBlock
          props={blockSchemas.RelatedPosts.parse({
            background: 'alt',
            spacing: 'md',
            eyebrow: 'Keep reading',
            heading: 'Related guides',
            limit: 3,
          })}
          ctx={{
            route: `/guides/${post.slug}`,
            currentPostSlug: post.slug,
            currentCategorySlug: post.category?.slug,
          }}
        />
      </article>
    </>
  )
}
