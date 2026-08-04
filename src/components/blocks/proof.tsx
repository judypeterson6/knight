import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import type { BlockPropsMap } from '@/lib/blocks/schema'
import { Card, CtaButton, Grid, Section, SectionHeading, SmartImage, SmartLink } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/icon'

/**
 * Stat counters.
 *
 * The number and its label are real text in the server-rendered HTML. Nothing
 * here is painted in by a scroll-triggered counter — a crawler and a visitor
 * with JS disabled both read "20+ coaches in fleet".
 */
export function StatCountersBlock({ props }: { props: BlockPropsMap['StatCounters'] }) {
  if (!props.items.length) return null
  const headingId = props.anchor ? `${props.anchor}-heading` : undefined
  const onDark = props.background === 'dark'

  return (
    <Section base={props} labelledBy={headingId}>
      <SectionHeading
        id={headingId}
        eyebrow={props.eyebrow}
        heading={props.heading}
        level={props.headingLevel}
        body={props.body}
        align={props.align}
        onDark={onDark}
        className={props.heading ? 'mb-10' : undefined}
      />
      <dl
        className={cn(
          'grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line',
          props.columns === 3 && 'lg:grid-cols-3',
          props.columns === 4 && 'lg:grid-cols-4',
        )}
      >
        {props.items.map((item) => (
          <div key={item.label} className="bg-surface px-5 py-8 text-center">
            <dd className="text-[clamp(1.8rem,3vw,2.4rem)] font-extrabold leading-none text-primary">{item.value}</dd>
            <dt className="mt-2.5 text-[0.78rem] font-bold uppercase tracking-[0.08em] text-muted">{item.label}</dt>
            {item.detail ? <p className="mt-2 text-step--1 text-subtle">{item.detail}</p> : null}
          </div>
        ))}
      </dl>
    </Section>
  )
}

/** Differentiators — each block states a verifiable fact, not an adjective. */
export function FeatureGridBlock({ props }: { props: BlockPropsMap['FeatureGrid'] }) {
  if (!props.items.length) return null
  const headingId = props.anchor ? `${props.anchor}-heading` : undefined

  return (
    <Section base={props} labelledBy={headingId}>
      <SectionHeading
        id={headingId}
        eyebrow={props.eyebrow}
        heading={props.heading}
        level={props.headingLevel}
        body={props.body}
        align={props.align}
        className="mb-12"
      />
      <Grid columns={props.columns} as="ul">
        {props.items.map((item) => (
          <Card key={item.title} as="li" className="p-7">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-[16px] bg-primary-soft text-primary">
              <Icon name={item.icon} className="h-6 w-6" />
            </span>
            <h3>{item.title}</h3>
            <p className="mt-2 text-step--1 leading-relaxed text-muted">{item.description}</p>
          </Card>
        ))}
      </Grid>
    </Section>
  )
}

/** Numbered how-to-book steps. */
export function StepsHowItWorksBlock({ props }: { props: BlockPropsMap['StepsHowItWorks'] }) {
  if (!props.items.length) return null
  const headingId = props.anchor ? `${props.anchor}-heading` : undefined

  return (
    <Section base={props} labelledBy={headingId}>
      <SectionHeading
        id={headingId}
        eyebrow={props.eyebrow}
        heading={props.heading}
        level={props.headingLevel}
        body={props.body}
        align={props.align}
        className="mb-12"
      />
      <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {props.items.map((item, i) => (
          <li key={item.title} className="rounded-card border border-line bg-surface-alt p-7">
            <div className="mb-6 flex items-center justify-between">
              <span className="relative flex h-16 w-16 items-center justify-center rounded-[18px] border border-line bg-surface text-primary">
                <Icon name={item.icon} className="h-6 w-6" />
                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-surface bg-primary text-[0.75rem] font-extrabold text-primary-contrast">
                  {i + 1}
                </span>
              </span>
              <span aria-hidden className="text-[3.2rem] font-black leading-none text-line">
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
            <h3>{item.title}</h3>
            <p className="mt-3 text-step--1 leading-relaxed text-muted">{item.description}</p>
          </li>
        ))}
      </ol>
      <CtaButton cta={props.cta} className="mt-10" />
    </Section>
  )
}

/**
 * Service cards. Every card links to its own page — there are no dead cards and
 * no "View Details" buttons pointing at `#`.
 */
export function ServiceCardsBlock({ props }: { props: BlockPropsMap['ServiceCards'] }) {
  const usable = props.items.filter((item) => item.cta.url)
  if (!usable.length) return null
  const headingId = props.anchor ? `${props.anchor}-heading` : undefined

  return (
    <Section base={props} labelledBy={headingId}>
      <SectionHeading
        id={headingId}
        eyebrow={props.eyebrow}
        heading={props.heading}
        level={props.headingLevel}
        body={props.body}
        align={props.align}
        className="mb-12"
      />
      <Grid columns={props.columns} as="ul" className="gap-6">
        {usable.map((item) => (
          <Card key={item.title} as="li" className="flex flex-col overflow-hidden sm:flex-row">
            {item.image.src ? (
              <div className="relative sm:w-[42%] sm:flex-shrink-0">
                <SmartImage
                  image={item.image}
                  className="h-52 w-full object-cover sm:h-full"
                  sizes="(max-width: 640px) 100vw, 40vw"
                />
                {item.badge ? (
                  <span className="absolute left-4 top-4 rounded-pill bg-primary px-3 py-1.5 text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-primary-contrast">
                    {item.badge}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-1 flex-col p-7">
              {item.kicker ? (
                <p className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-[0.16em] text-primary">
                  {item.kicker}
                </p>
              ) : null}
              <h3>
                <SmartLink href={item.cta.url} className="hover:text-primary">
                  {item.title}
                </SmartLink>
              </h3>
              <p className="mt-3 text-step--1 leading-relaxed text-muted">{item.description}</p>
              {item.bullets.length ? (
                <ul className="mt-4 space-y-2">
                  {item.bullets.map((bullet) => (
                    <li key={bullet.text} className="flex items-center gap-2.5 text-step--1 font-semibold">
                      <Icon name="check" className="h-4 w-4 flex-shrink-0 text-primary" />
                      {bullet.text}
                    </li>
                  ))}
                </ul>
              ) : null}
              <SmartLink
                href={item.cta.url}
                className="mt-auto pt-6 font-bold text-primary underline-offset-4 hover:underline"
              >
                {item.cta.label || `About ${item.title}`} <span aria-hidden>→</span>
              </SmartLink>
            </div>
          </Card>
        ))}
      </Grid>
    </Section>
  )
}

/**
 * Testimonials. Name, role and rating are all crawlable text; the star rating
 * additionally carries an aria-label. Nothing is synthesised — these are the
 * reviews the business actually published, and no AggregateRating is derived
 * from them anywhere in the schema output.
 */
export async function TestimonialsBlock({ props }: { props: BlockPropsMap['Testimonials'] }) {
  const items = await prisma.testimonial
    .findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { order: 'asc' },
      take: props.limit,
      include: { avatar: true },
    })
    .catch(() => [])

  if (!items.length) return null
  const headingId = props.anchor ? `${props.anchor}-heading` : undefined

  return (
    <Section base={props} labelledBy={headingId}>
      <SectionHeading
        id={headingId}
        eyebrow={props.eyebrow}
        heading={props.heading}
        level={props.headingLevel}
        body={props.body}
        align={props.align}
        className="mb-12"
      />
      <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <article className="flex h-full flex-col rounded-block border border-line bg-surface p-8 shadow-card">
              <p
                className="text-[0.95rem] font-bold tracking-[0.3em] text-[#f5a623]"
                aria-label={`Rated ${item.rating} out of 5`}
              >
                <span aria-hidden>{'★'.repeat(item.rating)}</span>
              </p>
              <p className="mt-1 text-step--1 text-subtle">{item.rating} out of 5</p>
              <blockquote className="mt-5 flex-1 text-step-1 font-bold leading-relaxed text-ink">
                <p>&ldquo;{item.quote}&rdquo;</p>
              </blockquote>
              <footer className="mt-6 flex items-center gap-4 border-t border-line pt-5">
                {item.avatar ? (
                  <SmartImage
                    image={{
                      src: item.avatar.path,
                      alt: item.avatar.alt || `${item.name}, ${item.role}`,
                      width: 56,
                      height: 56,
                      caption: '',
                      decorative: false,
                    }}
                    className="h-14 w-14 rounded-full object-cover"
                    sizes="56px"
                  />
                ) : null}
                <div>
                  <p className="font-extrabold">{item.name}</p>
                  <p className="text-step--1 font-bold text-primary">{item.role}</p>
                </div>
              </footer>
            </article>
          </li>
        ))}
      </ul>
    </Section>
  )
}
