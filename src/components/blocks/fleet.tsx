import type { Prisma } from '@prisma/client'
import { publishedCoachWhere } from '@/lib/publish'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import type { BlockPropsMap } from '@/lib/blocks/schema'
import type { BlockContext } from '@/lib/blocks/context'
import { Card, CtaButton, Section, SectionHeading, sectionHeadingId, SmartImage, SmartLink } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/icon'

export function formatPrice(price: number | null, currency: string): string | null {
  if (price === null) return null
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price)
}

/**
 * Reads the filter state out of the URL. The controls below are a real <form>
 * with method="get", so filtering works server-side with no JavaScript and the
 * filtered view is a shareable, crawlable URL.
 */
export interface FleetFilters {
  coachClass: string
  minBunks: number | null
  slides: string
  maxPrice: number | null
}

export function readFilters(searchParams: BlockContext['searchParams']): FleetFilters {
  const get = (key: string): string => {
    const value = searchParams?.[key]
    return (Array.isArray(value) ? value[0] : value) ?? ''
  }
  const num = (key: string): number | null => {
    const raw = Number(get(key))
    return Number.isFinite(raw) && raw > 0 ? raw : null
  }
  return {
    coachClass: get('class'),
    minBunks: num('bunks'),
    slides: get('slides'),
    maxPrice: num('maxPrice'),
  }
}

function whereFor(filters: FleetFilters, props: BlockPropsMap['FleetGrid']): Prisma.CoachWhereInput {
  const where: Prisma.CoachWhereInput = { ...publishedCoachWhere() }
  const classSlug = filters.coachClass || props.filterClass
  if (classSlug) where.class = { slug: classSlug }
  if (props.filterFeatured) where.featured = true
  if (filters.minBunks) where.bunks = { gte: filters.minBunks }
  if (filters.slides) where.slideOuts = { contains: filters.slides }
  if (filters.maxPrice) where.dailyPrice = { lte: filters.maxPrice }
  return where
}

/**
 * Fleet grid.
 *
 * Every card links to /fleet/<slug> — no card links to `#`. The spec values
 * (class, chassis, bunk count, slide-out and rear configuration, price) render
 * as a <dl> of real text, never inside the image.
 */
export async function FleetGridBlock({
  props,
  ctx,
}: {
  props: BlockPropsMap['FleetGrid']
  ctx: BlockContext
}) {
  const filters = props.showFilters ? readFilters(ctx.searchParams) : readFilters(undefined)

  const [coaches, classes, totalPublished, pricedCount, specVariants] = await Promise.all([
    prisma.coach
      .findMany({
        where: whereFor(filters, props),
        orderBy: [{ featured: 'desc' }, { displayOrder: 'asc' }],
        take: props.limit,
        include: { class: true, images: { orderBy: { order: 'asc' }, take: 1, include: { media: true } } },
      })
      .catch(() => []),
    props.showFilters
      ? prisma.coachClass
          // A class with nothing in it is an option that always returns an
          // empty grid, so it never reaches the control.
          .findMany({ where: { coaches: { some: publishedCoachWhere() } }, orderBy: { order: 'asc' } })
          .catch(() => [])
      : Promise.resolve([]),
    prisma.coach.count({ where: publishedCoachWhere() }).catch(() => 0),
    prisma.coach.count({ where: { ...publishedCoachWhere(), NOT: { dailyPrice: null } } }).catch(() => 0),
    // The bunk and slide-out controls are built from the values the fleet
    // actually holds. A uniform fleet gets no control at all rather than a
    // menu of options that every coach would match.
    props.showFilters
      ? prisma.coach
          .findMany({ where: publishedCoachWhere(), select: { bunks: true, slideOuts: true }, distinct: ['bunks', 'slideOuts'] })
          .catch(() => [] as { bunks: number; slideOuts: string }[])
      : Promise.resolve([] as { bunks: number; slideOuts: string }[]),
  ])

  const headingId = sectionHeadingId(props)
  const filtered = Boolean(filters.coachClass || filters.minBunks || filters.slides || filters.maxPrice)
  // The price control only renders when at least one coach carries a published
  // rate. A filter that cannot change the result set has no business being on
  // the page.
  const showPriceFilter = pricedCount > 0
  // Same rule for the spec controls: offer them only where the fleet varies.
  const bunkOptions = [...new Set(specVariants.map((c) => c.bunks))].sort((a, b) => a - b)
  const slideOptions = [...new Set(specVariants.map((c) => c.slideOuts).filter(Boolean))].sort()
  const showBunkFilter = bunkOptions.length > 1
  const showSlideFilter = slideOptions.length > 1
  const showClassFilter = classes.length > 1
  const filterCols =
    Number(showClassFilter) + Number(showBunkFilter) + Number(showSlideFilter) + Number(showPriceFilter)
  // With a uniform fleet every control would return the same set, so the whole
  // form stands down rather than shipping four decorative selects.
  const showFilterForm = props.showFilters && filterCols > 0

  return (
    <Section base={props} labelledBy={headingId}>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          id={headingId}
          eyebrow={props.eyebrow}
          heading={props.heading}
          level={props.headingLevel}
          body={props.body}
          className="max-w-2xl"
        />
        <CtaButton cta={props.cta} />
      </div>

      {showFilterForm ? (
        <form method="get" className="mb-8 rounded-card border border-line bg-surface-alt p-5" aria-label="Filter the fleet">
          <div
            className={cn(
              'grid gap-4 sm:grid-cols-2',
              filterCols >= 4 ? 'lg:grid-cols-5' : filterCols === 3 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
            )}
          >
            {showClassFilter ? (
              <div>
                <label htmlFor="filter-class" className="kc-label">
                  Class
                </label>
                <select id="filter-class" name="class" defaultValue={filters.coachClass} className="kc-field">
                  <option value="">All classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {showBunkFilter ? (
              <div>
                <label htmlFor="filter-bunks" className="kc-label">
                  Minimum bunks
                </label>
                <select id="filter-bunks" name="bunks" defaultValue={filters.minBunks?.toString() ?? ''} className="kc-field">
                  <option value="">Any</option>
                  {bunkOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}+ bunks
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {showSlideFilter ? (
              <div>
                <label htmlFor="filter-slides" className="kc-label">
                  Slide-outs
                </label>
                <select id="filter-slides" name="slides" defaultValue={filters.slides} className="kc-field">
                  <option value="">Any</option>
                  {slideOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {showPriceFilter ? (
              <div>
                <label htmlFor="filter-price" className="kc-label">
                  Max daily price
                </label>
                <input
                  id="filter-price"
                  name="maxPrice"
                  type="number"
                  min={1}
                  step={10}
                  defaultValue={filters.maxPrice ?? ''}
                  placeholder="Any"
                  className="kc-field"
                />
              </div>
            ) : null}
            <div className="flex items-end gap-3">
              <button type="submit" className="kc-btn kc-btn-primary !px-6 !py-3.5">
                Apply
              </button>
              {filtered ? (
                <SmartLink href="/fleet" className="kc-btn kc-btn-outline !px-5 !py-3.5">
                  Reset
                </SmartLink>
              ) : null}
            </div>
          </div>
          <p role="status" aria-live="polite" className="mt-4 text-step--1 text-muted">
            Showing {coaches.length} of {totalPublished} coaches
            {filtered ? ' matching your filters' : ''}.
          </p>
        </form>
      ) : null}

      {coaches.length === 0 ? (
        <p className="rounded-card border border-line bg-surface-alt p-8 text-center text-muted">
          No coaches match those filters. Try widening the bunk count or price, or{' '}
          <SmartLink href="/contact-us" className="font-bold text-primary-deep underline">
            ask us to match you to a coach
          </SmartLink>
          .
        </p>
      ) : (
        <ul
          className={cn('grid grid-cols-1 gap-6 sm:grid-cols-2', props.columns === 3 && 'lg:grid-cols-3')}
        >
          {coaches.map((coach) => {
            const image = coach.images[0]?.media
            const price = formatPrice(coach.dailyPrice, coach.currency)
            const href = `/fleet/${coach.slug}`
            return (
              <Card key={coach.id} as="li" className="overflow-hidden">
                <article>
                  <SmartLink href={href} className="block">
                    <div className="relative">
                      {image ? (
                        <SmartImage
                          image={{
                            src: image.path,
                            alt: image.alt || `${coach.name}, a ${coach.chassis} entertainer coach`,
                            width: image.width ?? 1024,
                            height: image.height ?? 691,
                            caption: '',
                            decorative: false,
                          }}
                          className="h-56 w-full object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      ) : (
                        <div aria-hidden className="h-56 w-full bg-surface-alt" />
                      )}
                      {coach.tagline ? (
                        <span className="absolute left-4 top-4 rounded-pill bg-primary px-3 py-1.5 text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-primary-contrast">
                          {coach.tagline}
                        </span>
                      ) : null}
                      {coach.class ? (
                        <span className="absolute right-4 top-4 rounded-pill bg-surface/95 px-3 py-1.5 text-[0.72rem] font-extrabold">
                          {coach.class.name}
                        </span>
                      ) : null}
                    </div>
                  </SmartLink>

                  <div className="p-6">
                    <h3 className="text-step-2">
                      <SmartLink href={href} className="hover:text-primary-deep">
                        {coach.name}
                      </SmartLink>
                    </h3>
                    <p className="mt-1 text-[0.78rem] font-bold uppercase tracking-[0.06em] text-subtle">
                      {coach.chassis}
                    </p>

                    {/* Spec as crawlable text, not baked into the photograph. */}
                    <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-line py-5 text-step--1">
                      <div>
                        <dt className="sr-only">Bunks</dt>
                        <dd className="flex items-center gap-2.5 font-semibold">
                          <Icon name="bed" className="h-4 w-4 flex-shrink-0 text-primary" />
                          {coach.bunks} bunks
                        </dd>
                      </div>
                      {/* Slide-out and rear layout are only stated for the
                          coaches the operator actually specifies them for, so
                          an unset value renders nothing rather than a blank
                          row or an invented configuration. */}
                      {coach.slideOuts ? (
                        <div>
                          <dt className="sr-only">Slide-outs</dt>
                          <dd className="flex items-center gap-2.5 font-semibold">
                            <Icon name="slide-out" className="h-4 w-4 flex-shrink-0 text-primary" />
                            {coach.slideOuts}
                          </dd>
                        </div>
                      ) : null}
                      {coach.rearConfig ? (
                        <div>
                          <dt className="sr-only">Rear configuration</dt>
                          <dd className="flex items-center gap-2.5 font-semibold">
                            <Icon name="couch" className="h-4 w-4 flex-shrink-0 text-primary" />
                            {coach.rearConfig}
                          </dd>
                        </div>
                      ) : null}
                      <div className="col-span-2 flex items-center gap-2.5">
                        <dt className="font-semibold text-muted">Daily rate</dt>
                        <dd className="font-extrabold text-primary-deep">
                          {price ? `${price} per day` : 'Quoted per tour'}
                        </dd>
                      </div>
                    </dl>

                    {/* Book Now goes to the reservation page carrying the coach
                        so the form arrives pre-selected; View details stays on
                        the coach's own page. Both are real routes. */}
                    <div className="mt-6 flex flex-col gap-2.5">
                      <SmartLink
                        href={`/reservation?coach=${encodeURIComponent(coach.slug)}`}
                        className="kc-btn kc-btn-primary w-full"
                      >
                        Book {coach.name}
                      </SmartLink>
                      <SmartLink href={href} className="kc-btn kc-btn-outline w-full">
                        View details
                      </SmartLink>
                    </div>
                  </div>
                </article>
              </Card>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

/**
 * Spec glossary and class comparison — "what the specs mean". Renders as real
 * <dl> and <table> elements so the definitions are retrievable text.
 */
export async function CoachSpecTableBlock({ props }: { props: BlockPropsMap['CoachSpecTable'] }) {
  const headingId = sectionHeadingId(props)

  const classes = props.showClassComparison
    ? await prisma.coachClass
        .findMany({
          orderBy: { order: 'asc' },
          include: {
            coaches: {
              where: publishedCoachWhere(),
              orderBy: { displayOrder: 'asc' },
              select: { name: true, slug: true, chassis: true, bunks: true, slideOuts: true, rearConfig: true, dailyPrice: true, currency: true },
            },
          },
        })
        .catch(() => [])
    : []

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

      {props.showClassComparison && classes.length ? (
        <div className="mb-12 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-step--1">
            <caption className="sr-only">Knights Coaches fleet by class, chassis, bunk count and configuration</caption>
            <thead>
              <tr className="bg-surface-alt text-left">
                <th scope="col" className="border border-line px-4 py-3">Coach</th>
                <th scope="col" className="border border-line px-4 py-3">Class</th>
                <th scope="col" className="border border-line px-4 py-3">Chassis</th>
                <th scope="col" className="border border-line px-4 py-3">Bunks</th>
                <th scope="col" className="border border-line px-4 py-3">Slide-outs</th>
                <th scope="col" className="border border-line px-4 py-3">Rear</th>
                <th scope="col" className="border border-line px-4 py-3">Daily rate</th>
              </tr>
            </thead>
            <tbody>
              {classes.flatMap((cls) =>
                cls.coaches.map((coach) => (
                  <tr key={coach.slug}>
                    <th scope="row" className="border border-line px-4 py-3 text-left font-bold">
                      <SmartLink href={`/fleet/${coach.slug}`} className="text-primary hover:underline">
                        {coach.name}
                      </SmartLink>
                    </th>
                    <td className="border border-line px-4 py-3">{cls.name}</td>
                    <td className="border border-line px-4 py-3">{coach.chassis}</td>
                    <td className="border border-line px-4 py-3">{coach.bunks}</td>
                    {/* A cell the operator has not specified says so, rather
                        than sitting blank or carrying an invented value. */}
                    <td className="border border-line px-4 py-3">{coach.slideOuts || 'Not specified'}</td>
                    <td className="border border-line px-4 py-3">{coach.rearConfig || 'Not specified'}</td>
                    <td className="border border-line px-4 py-3">
                      {formatPrice(coach.dailyPrice, coach.currency) ?? 'Quoted per tour'}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {props.rows.length ? (
        <dl className="grid gap-5 sm:grid-cols-2">
          {props.rows.map((row) => (
            <div key={row.term} className="rounded-card border border-line bg-surface p-6">
              <dt className="font-extrabold">{row.term}</dt>
              <dd className="mt-2 text-step--1 leading-relaxed text-muted">{row.definition}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Section>
  )
}
