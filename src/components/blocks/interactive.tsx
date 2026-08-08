import { prisma } from '@/lib/prisma'
import { publishedPostWhere } from '@/lib/publish'
import { getSettings } from '@/lib/settings'
import { getForm } from '@/lib/forms'
import { cn, excerptFrom, formatDate, formatPhone, isoDate, telHref } from '@/lib/utils'
import type { BlockPropsMap } from '@/lib/blocks/schema'
import type { BlockContext } from '@/lib/blocks/context'
import { Card, CtaButton, Prose, Section, SectionHeading, sectionHeadingId, SmartImage, SmartLink } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/icon'
import { FaqAccordionClient } from '@/components/blocks/faq-accordion-client'

/**
 * FAQ accordion.
 *
 * Every answer is present in the initial server-rendered HTML inside a real
 * <details>-free markup structure; the client component only adds the collapse
 * behaviour after hydration. Answers are never fetched or injected on click,
 * and with JavaScript disabled every answer stays open and readable.
 */
export async function FaqAccordionBlock({ props }: { props: BlockPropsMap['FaqAccordion'] }) {
  const [items, { organization }] = await Promise.all([
    prisma.faqItem
      .findMany({
        where: { group: props.group, status: 'PUBLISHED' },
        orderBy: { order: 'asc' },
        take: props.limit,
      })
      .catch(() => []),
    getSettings(),
  ])

  if (!items.length) return null
  const headingId = sectionHeadingId(props, 'faq-heading')

  const aside = (
    <div className="lg:sticky lg:top-28">
      <SectionHeading
        id={headingId}
        eyebrow={props.eyebrow}
        heading={props.heading}
        level={props.headingLevel}
        body={props.body}
      />
      {props.supportTitle ? (
        <aside className="relative mt-8 overflow-hidden rounded-block bg-surface-dark p-8">
          <span className="mb-5 flex h-13 w-13 items-center justify-center rounded-[14px] bg-primary p-3 text-primary-contrast">
            <Icon name="headset" className="h-6 w-6" />
          </span>
          <h3 className="text-on-dark">{props.supportTitle}</h3>
          <Prose html={props.supportBody} className="mt-2 text-step--1 leading-relaxed text-on-dark-muted" />
          <a href={telHref(organization.phone)} className="kc-btn kc-btn-primary mt-6 w-full">
            {props.supportPhoneLabel || 'Call'} {formatPhone(organization.phone)}
          </a>
          <CtaButton cta={props.supportCta} className="mt-3 w-full !border-white/20 !text-on-dark" />
        </aside>
      ) : null}
    </div>
  )

  return (
    <Section base={props} labelledBy={headingId}>
      <div className={cn(props.layout === 'split' ? 'grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16' : '')}>
        {props.layout === 'split' ? aside : <div className="mb-10">{aside}</div>}
        <FaqAccordionClient items={items.map((i) => ({ id: i.id, question: i.question, answer: i.answer }))} />
      </div>
    </Section>
  )
}

/** Contact details plus the contact form. Address is a real <address> element. */
export async function ContactBlockBlock({ props }: { props: BlockPropsMap['ContactBlock'] }) {
  const [{ organization }, form] = await Promise.all([
    getSettings(),
    props.showForm ? getForm(props.formSlug) : Promise.resolve(null),
  ])
  const headingId = sectionHeadingId(props)
  const { QuoteFormClient } = await import('@/components/forms/quote-form-client')

  const formNameIsRedundant =
    !!form &&
    [props.eyebrow, props.heading].some((text) => text.trim().toLowerCase() === form.name.trim().toLowerCase())

  const cards = [
    props.showPhone && {
      icon: 'phone',
      label: 'Call us',
      value: formatPhone(organization.phone),
      href: telHref(organization.phone),
    },
    props.showEmail && {
      icon: 'envelope',
      label: 'Email us',
      value: organization.email,
      href: `mailto:${organization.email}`,
    },
    props.showAddress && {
      icon: 'location-dot',
      label: 'Visit us',
      value: `${organization.addressLocality}, ${organization.addressRegion}`,
      href: null,
    },
  ].filter(Boolean) as { icon: string; label: string; value: string; href: string | null }[]

  return (
    <Section base={props} labelledBy={headingId}>
      <SectionHeading
        id={headingId}
        eyebrow={props.eyebrow}
        heading={props.heading}
        level={props.headingLevel}
        body={props.body}
        align={props.align}
        className="mb-10"
      />

      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {cards.map((card) => {
          const inner = (
            <>
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[15px] bg-primary text-primary-contrast">
                <Icon name={card.icon} className="h-6 w-6" />
              </span>
              <span>
                <span className="block text-[0.78rem] font-bold uppercase tracking-[0.08em] text-subtle">
                  {card.label}
                </span>
                <span className="mt-1 block text-step-0 font-extrabold">{card.value}</span>
              </span>
            </>
          )
          return (
            <li key={card.label}>
              {card.href ? (
                <a
                  href={card.href}
                  className="flex h-full items-center gap-5 rounded-card border border-line bg-surface-alt p-7 transition hover:-translate-y-1 hover:shadow-card"
                >
                  {inner}
                </a>
              ) : (
                <div className="flex h-full items-center gap-5 rounded-card border border-line bg-surface-alt p-7">
                  {inner}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* The form gets roughly two thirds; the details column is short, so a
          near-even split left a large empty band beside it. */}
      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] lg:gap-14">
        {form ? (
          <div className="rounded-block border border-line bg-surface p-6 shadow-card md:p-10">
            {/* The section eyebrow, heading and body already introduce this
                form. Printing the form's own name and description again stacked
                the same sentence three times above the first field, so each is
                kept only when it is not already said — the heading stays in the
                document outline either way. */}
            <h3 className={cn('mb-6 text-step-3', formNameIsRedundant && 'sr-only')}>{form.name}</h3>
            <QuoteFormClient form={form} hideDescription={Boolean(props.body.trim())} />
          </div>
        ) : null}

        <div className="space-y-8">
          {props.showAddress ? (
            <div>
              <h3>Office</h3>
              <address className="mt-3 not-italic leading-relaxed text-muted">
                {organization.name}
                <br />
                {organization.streetAddress}
                <br />
                {organization.addressLocality}, {organization.addressRegion} {organization.postalCode}
                <br />
                {organization.addressCountry}
              </address>
            </div>
          ) : null}

          {props.showHours ? (
            <div>
              <h3>Dispatch hours</h3>
              <p className="mt-3 flex items-center gap-2.5 font-semibold text-muted">
                <span aria-hidden className="h-2 w-2 rounded-full bg-success" />
                {props.hoursLabel}
              </p>
            </div>
          ) : null}

          {props.mapEmbedUrl ? (
            <figure>
              <iframe
                src={props.mapEmbedUrl}
                title={props.mapTitle}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="aspect-[4/3] w-full rounded-card border border-line"
              />
              <figcaption className="mt-3 text-step--1 text-subtle">
                {organization.streetAddress}, {organization.addressLocality}, {organization.addressRegion}{' '}
                {organization.postalCode}
              </figcaption>
            </figure>
          ) : null}
        </div>
      </div>
    </Section>
  )
}

/** Related reading — three posts, linked by category where one is available. */
export async function RelatedPostsBlock({
  props,
  ctx,
}: {
  props: BlockPropsMap['RelatedPosts']
  ctx: BlockContext
}) {
  const categorySlug = props.categorySlug || ctx.currentCategorySlug || ''
  const excludeSlug = props.excludeSlug || ctx.currentPostSlug || ''

  const posts = await prisma.post
    .findMany({
      where: {
        ...publishedPostWhere(),
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
        ...(excludeSlug ? { NOT: { slug: excludeSlug } } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      take: props.limit,
      include: { featuredImage: true, category: true },
    })
    .catch(() => [])

  if (!posts.length) return null
  const headingId = sectionHeadingId(props)

  return (
    <Section base={props} labelledBy={headingId} as="aside">
      <SectionHeading
        id={headingId}
        eyebrow={props.eyebrow}
        heading={props.heading}
        level={props.headingLevel}
        body={props.body}
        align={props.align}
        className="mb-10"
      />
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Card key={post.id} as="li" className="overflow-hidden">
            <article>
              <SmartLink href={`/blog/${post.slug}`} className="block">
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
                    className="h-48 w-full object-cover"
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
                <h3 className="mt-2 text-step-1">
                  <SmartLink href={`/blog/${post.slug}`} className="hover:text-primary">
                    {post.title}
                  </SmartLink>
                </h3>
                <p className="mt-3 text-step--1 leading-relaxed text-muted">
                  {post.excerpt || excerptFrom(post.body, 130)}
                </p>
                {post.publishedAt ? (
                  <p className="mt-4 text-step--1 text-subtle">
                    <time dateTime={isoDate(post.publishedAt)}>{formatDate(post.publishedAt)}</time>
                  </p>
                ) : null}
              </div>
            </article>
          </Card>
        ))}
      </ul>
    </Section>
  )
}
