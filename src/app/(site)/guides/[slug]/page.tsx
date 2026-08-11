import type { Metadata } from 'next'
import { isLive, publishedPostWhere } from '@/lib/publish'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { buildMetadata } from '@/lib/seo'
import { blogPostingNode, breadcrumbNode, buildGraph, organizationNode } from '@/lib/schema-org'
import { excerptFrom, formatDate, isoDate, readingMinutes, sanitizeHtml } from '@/lib/utils'
import { withHeadingAnchors } from '@/lib/toc'
import { JsonLd } from '@/components/seo/json-ld'
import { Section, SmartImage, SmartLink } from '@/components/ui/primitives'
import { RelatedPostsBlock } from '@/components/blocks/interactive'
import { TableOfContents } from '@/components/blog/table-of-contents'
import { AuthorAvatar, AuthorCard, type AuthorSummary } from '@/components/blog/author-card'
import { blockSchemas } from '@/lib/blocks/schema'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

/**
 * Loads a guide, or throws.
 *
 * Deliberately does not swallow query errors. A failed lookup and a missing
 * guide are different things: swallowing the first turns a database outage
 * into a 404, which tells a crawler the URL is gone and invites it to drop the
 * page from the index. A thrown error becomes a 500, which says "try again".
 *
 * This is not hypothetical here. The host caps connections per hour, and while
 * that cap was exhausted every guide on the site answered 404.
 */
async function loadPost(slug: string) {
  return prisma.post.findUnique({
    where: { slug },
    include: { author: { include: { avatar: true } }, category: true, featuredImage: true },
  })
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
  // Metadata is not worth failing a render over; the page body below decides
  // whether this is a 404 or a 500.
  const post = await loadPost(slug).catch(() => null)
  if (!post || !isLive(post)) return { title: 'Guide not found' }

  return buildMetadata({
    entityType: 'POST',
    entityId: post.id,
    route: `/guides/${post.slug}`,
    fallbackTitle: post.title,
    fallbackDescription: post.excerpt || excerptFrom(post.body, 150),
    fallbackImage: post.featuredImage?.path ?? null,
    type: 'article',
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
    authorName: post.author?.name ?? null,
  })
}

/**
 * Guide detail page.
 *
 * Above the fold: the H1, then the direct answer in the opening sentences,
 * uninterrupted by share buttons, an ad slot or a newsletter box. The byline
 * sits under the answer, and the author's full card closes the article rather
 * than pushing the content down.
 *
 * On large screens the body runs beside a sticky contents list built from the
 * article's own headings. Anchor ids are injected at render time by
 * withHeadingAnchors, so the list cannot drift out of step with the prose.
 */
export default async function GuidePost({ params }: Props) {
  const { slug } = await params
  const post = await loadPost(slug)
  if (!post || !isLive(post)) notFound()

  const lede = post.excerpt || excerptFrom(post.body, 320)
  const { html, toc } = withHeadingAnchors(sanitizeHtml(post.body))

  const author: AuthorSummary | null = post.author
    ? {
        name: post.author.name,
        bio: post.author.bio,
        avatar: post.author.avatar
          ? {
              path: post.author.avatar.path,
              alt: post.author.avatar.alt,
              width: post.author.avatar.width,
              height: post.author.avatar.height,
            }
          : null,
      }
    : null

  // Only surface an update date when it is a real revision, not the timestamp
  // touched by a re-seed on the same day the guide went out.
  const updated =
    post.publishedAt && post.updatedAt.getTime() - post.publishedAt.getTime() > 24 * 60 * 60 * 1000
      ? post.updatedAt
      : null

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
        { name: 'Guides', url: '/guides' },
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
        {/* --- Masthead ---------------------------------------------------- */}
        <Section base={{ background: 'alt', spacing: 'md', align: 'left', anchor: '', className: 'pt-32 md:pt-36' }}>
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
                    Guides
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

            {post.category ? (
              <SmartLink
                href={`/guides/category/${post.category.slug}`}
                className="inline-flex rounded-pill bg-primary px-3.5 py-1.5 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-primary-contrast"
              >
                {post.category.name}
              </SmartLink>
            ) : null}

            <h1 className="mt-5">{post.title}</h1>

            {/* The direct answer, immediately after the H1. */}
            {lede ? <p className="mt-6 text-step-1 leading-[1.7] text-muted">{lede}</p> : null}

            {/* Byline. Avatar plus name reads as authorship; the dates and
                reading time are secondary and set smaller. */}
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-4 border-t border-line pt-6">
              {author ? (
                <div className="flex items-center gap-3">
                  <AuthorAvatar author={author} size="sm" />
                  <div className="leading-tight">
                    <p className="text-step--1 font-extrabold">{author.name}</p>
                    <p className="text-[0.78rem] text-subtle">Knights Coaches</p>
                  </div>
                </div>
              ) : null}

              <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 text-step--1 text-subtle">
                {post.publishedAt ? (
                  <div className="flex items-center gap-1.5">
                    <dt className="sr-only">Published</dt>
                    <dd>
                      <time dateTime={isoDate(post.publishedAt)}>{formatDate(post.publishedAt)}</time>
                    </dd>
                  </div>
                ) : null}
                {updated ? (
                  <div className="flex items-center gap-1.5">
                    <dt className="font-semibold">Updated</dt>
                    <dd>
                      <time dateTime={isoDate(updated)}>{formatDate(updated)}</time>
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-center gap-1.5">
                  <dt className="sr-only">Reading time</dt>
                  <dd>{readingMinutes(post.body)} min read</dd>
                </div>
              </dl>
            </div>
          </div>
        </Section>

        {post.featuredImage ? (
          <Section base={{ background: 'surface', spacing: 'none', align: 'left', anchor: '', className: 'pt-12' }}>
            <figure className="mx-auto max-w-5xl">
              <SmartImage
                image={{
                  src: post.featuredImage.path,
                  alt: post.featuredImage.alt || post.title,
                  width: post.featuredImage.width ?? 1200,
                  height: post.featuredImage.height ?? 750,
                  caption: '',
                  decorative: false,
                }}
                className="aspect-[16/8] w-full rounded-block object-cover shadow-card"
                priority
                sizes="(max-width: 1024px) 100vw, 72rem"
              />
              {post.featuredImage.caption ? (
                <figcaption className="mt-3 text-step--1 text-subtle">{post.featuredImage.caption}</figcaption>
              ) : null}
            </figure>
          </Section>
        ) : null}

        {/* --- Body beside the contents list -------------------------------- */}
        <Section base={{ background: 'surface', spacing: 'md', align: 'left', anchor: '', className: '' }}>
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-16">
            <div className="min-w-0">
              <div className="kc-prose max-w-3xl" dangerouslySetInnerHTML={{ __html: html }} />
              {author ? <AuthorCard author={author} role="Dispatch and operations" /> : null}
            </div>

            {/* Ordered after the article in the DOM so a screen reader and a
                narrow viewport both meet the content first; CSS lifts it into
                the right-hand column on large screens. */}
            <aside className="order-first lg:order-none">
              <TableOfContents items={toc} />
            </aside>
          </div>
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
