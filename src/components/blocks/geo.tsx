import { prisma } from '@/lib/prisma'
import { publishedLocationWhere } from '@/lib/publish'
import { cn } from '@/lib/utils'
import type { BlockPropsMap } from '@/lib/blocks/schema'
import { Card, CtaButton, Section, SectionHeading, sectionHeadingId, SmartImage, SmartLink } from '@/components/ui/primitives'
import { UsCoverageMap } from '@/components/ui/us-coverage-map'

/**
 * Coverage map.
 *
 * The map is an inline SVG marked aria-hidden, because a map is a picture of a
 * fact rather than the fact itself. The states and the primary markets are
 * output alongside it as real <a> links, so the coverage claim is retrievable
 * without parsing SVG paths.
 */
export function CoverageMapBlock({ props }: { props: BlockPropsMap['CoverageMap'] }) {
  const headingId = sectionHeadingId(props)
  const servedCodes = new Set(props.states.map((s) => s.code))
  // DC is served but is a federal district, not a state — counting it as one
  // produced "49 states" against the 48 claimed in the heading and body copy.
  const servesDc = servedCodes.has('DC')
  const stateCount = props.states.length - (servesDc ? 1 : 0)

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

      {props.showMap ? (
        <figure className="mx-auto mb-12 max-w-5xl">
          <UsCoverageMap servedCodes={servedCodes} />
          <figcaption className="mt-4 text-center text-step--1 text-subtle">
            {/* Counted excluding DC, which is in the served list but is not a state.
                Saying "49 states" here contradicted the 48 claimed everywhere else. */}
            Knights Coaches serves {stateCount} states
            {servesDc ? ' and the District of Columbia' : ''}. Alaska and Hawaii are outside the service area. The
            full list is below as text links.
          </figcaption>
        </figure>
      ) : null}

      {/* Two panels rather than two bare columns. The states list is far denser
          than the markets list, so as plain columns the shorter one left a wide
          empty band; panels give both a floor and keep the section balanced. */}
      <div className="grid gap-6 lg:grid-cols-[1.35fr_minmax(0,1fr)] lg:gap-8">
        {props.states.length ? (
          <div className="rounded-block border border-line bg-surface p-7 text-left md:p-9">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-step-1">{props.statesHeading}</h3>
              <p className="text-step--1 font-bold uppercase tracking-[0.08em] text-subtle">
                {stateCount} states{servesDc ? ' + DC' : ''}
              </p>
            </div>

            {/* Fixed-width code column so every state name starts on the same
                vertical line — the wrapped pills this replaces left a ragged
                right edge and no two rows lined up. */}
            <ul className="mt-6 grid grid-cols-2 gap-x-7 sm:grid-cols-3">
              {props.states.map((state) => (
                <li key={state.code} className="flex items-center gap-2.5 border-b border-line py-2.5">
                  <span className="w-7 flex-shrink-0 text-step--1 font-extrabold text-primary">{state.code}</span>
                  <span className="truncate text-step--1 font-semibold text-muted">{state.name}</span>
                </li>
              ))}
            </ul>

            {props.excludedNote ? (
              <p className="mt-6 text-step--1 leading-relaxed text-muted">{props.excludedNote}</p>
            ) : null}
          </div>
        ) : null}

        {props.markets.length ? (
          <div className="rounded-block border border-line bg-surface-alt p-7 text-left md:p-9">
            <h3 className="text-step-1">{props.marketsHeading}</h3>
            {/* These are city pages. Rendered as plain bold text they read as
                static labels, so they carry a row, a hover state and an arrow. */}
            <ul className="mt-6 grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {props.markets.map((market) => (
                <li key={market.label}>
                  {market.url ? (
                    <SmartLink
                      href={market.url}
                      className="group flex items-center justify-between gap-4 rounded-card px-4 py-2.5 font-bold text-ink transition hover:bg-surface"
                    >
                      <span className="truncate">{market.label}</span>
                      <span
                        aria-hidden
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-line bg-surface text-step--1 text-subtle transition group-hover:border-primary group-hover:bg-primary group-hover:text-primary-contrast"
                      >
                        →
                      </span>
                    </SmartLink>
                  ) : (
                    <span className="flex px-4 py-2.5 font-bold text-muted">{market.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <CtaButton cta={props.cta} className="mt-10" />
    </Section>
  )
}

/** Destination cards, driven by the Location table. Every card links to its page. */
export async function DestinationGridBlock({ props }: { props: BlockPropsMap['DestinationGrid'] }) {
  const locations = await prisma.location
    .findMany({
      where: {
        ...publishedLocationWhere(),
        ...(props.hubsOnly ? { isHub: true } : {}),
        NOT: { path: null },
      },
      orderBy: [{ isHub: 'desc' }, { order: 'asc' }],
      take: props.limit,
      include: { image: true },
    })
    .catch(() => [])

  if (!locations.length) return null
  const headingId = sectionHeadingId(props)

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

      <ul
        className={cn(
          'grid grid-cols-1 gap-5 sm:grid-cols-2',
          props.columns === 3 && 'lg:grid-cols-3',
          props.columns === 4 && 'lg:grid-cols-4',
        )}
      >
        {locations.map((location) => {
          const label = location.state ? `${location.city}, ${location.state}` : location.city
          return (
            <Card key={location.id} as="li" className="overflow-hidden">
              <article>
                <SmartLink href={location.path ?? '#'} className="block">
                  {location.image ? (
                    <SmartImage
                      image={{
                        src: location.image.path,
                        alt: location.image.alt || `Entertainer coach rental in ${label}`,
                        width: location.image.width ?? 800,
                        height: location.image.height ?? 600,
                        caption: '',
                        decorative: false,
                      }}
                      className="h-52 w-full object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  ) : (
                    <div aria-hidden className="h-52 w-full bg-surface-alt" />
                  )}
                </SmartLink>
                <div className="flex items-center justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <h3 className="text-step-1">
                      <SmartLink href={location.path ?? '#'} className="hover:text-primary">
                        {label}
                      </SmartLink>
                    </h3>
                    <p className="mt-0.5 text-step--1 font-semibold text-subtle">
                      {location.region ? `${location.region} · United States` : 'United States'}
                    </p>
                  </div>
                  <span
                    aria-hidden
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-alt text-ink"
                  >
                    →
                  </span>
                </div>
              </article>
            </Card>
          )
        })}
      </ul>
    </Section>
  )
}
