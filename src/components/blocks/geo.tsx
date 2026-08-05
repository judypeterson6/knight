import { prisma } from '@/lib/prisma'
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
            Knights Coaches serves {props.states.length} states. The full list is below as text links.
          </figcaption>
        </figure>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-2">
        {props.states.length ? (
          <div>
            <h3>{props.statesHeading}</h3>
            <ul className="mt-5 flex flex-wrap gap-x-3 gap-y-2">
              {props.states.map((state) => (
                <li key={state.code}>
                  <span className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1.5 text-step--1 font-semibold">
                    <span className="text-primary">{state.code}</span>
                    <span className="text-muted">{state.name}</span>
                  </span>
                </li>
              ))}
            </ul>
            {props.excludedNote ? (
              <p className="mt-5 text-step--1 leading-relaxed text-muted">{props.excludedNote}</p>
            ) : null}
          </div>
        ) : null}

        {props.markets.length ? (
          <div>
            <h3>{props.marketsHeading}</h3>
            <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {props.markets.map((market) => (
                <li key={market.label}>
                  {market.url ? (
                    <SmartLink
                      href={market.url}
                      className="font-semibold text-ink underline-offset-4 hover:text-primary hover:underline"
                    >
                      {market.label}
                    </SmartLink>
                  ) : (
                    <span className="font-semibold text-muted">{market.label}</span>
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
        status: 'PUBLISHED',
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
