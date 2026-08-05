import type { Metadata } from 'next'
import { isLive, publishedCoachWhere } from '@/lib/publish'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { buildMetadata } from '@/lib/seo'
import { breadcrumbNode, buildGraph, coachNode, faqNode, organizationNode } from '@/lib/schema-org'
import { getSettings } from '@/lib/settings'
import { formatPhone, telHref } from '@/lib/utils'
import { JsonLd } from '@/components/seo/json-ld'
import { Card, Section, SectionHeading, SmartImage, SmartLink } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/icon'
import { formatPrice } from '@/components/blocks/fleet'
import { FaqAccordionClient } from '@/components/blocks/faq-accordion-client'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

async function loadCoach(slug: string) {
  try {
    return await prisma.coach.findUnique({
      where: { slug },
      include: {
        class: true,
        images: { orderBy: { order: 'asc' }, include: { media: true } },
      },
    })
  } catch {
    return null
  }
}

export async function generateStaticParams() {
  try {
    const coaches = await prisma.coach.findMany({ where: publishedCoachWhere(), select: { slug: true } })
    return coaches.map((c) => ({ slug: c.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const coach = await loadCoach(slug)
  if (!coach || !isLive(coach)) return { title: 'Coach not found' }

  const price = formatPrice(coach.dailyPrice, coach.currency)
  return buildMetadata({
    entityType: 'COACH',
    entityId: coach.id,
    route: `/fleet/${coach.slug}`,
    fallbackTitle: `${coach.name} — ${coach.class?.name ?? ''} ${coach.chassis} Entertainer Coach`.replace(/\s+/g, ' ').trim(),
    fallbackDescription: `${coach.name} is a ${coach.chassis} entertainer coach with ${coach.bunks} bunks, a ${coach.slideOuts.toLowerCase()} layout and a ${coach.rearConfig.toLowerCase()}.${price ? ` From ${price} per day.` : ''} CDL driver and 24/7 dispatch included.`,
    fallbackImage: coach.images[0]?.media.path ?? null,
  })
}

/**
 * Coach detail.
 *
 * Above the fold: gallery, name, class, daily price, availability, the spec
 * block and the request-this-coach CTA. Below: the full spec <table>, the
 * layout description, similar coaches and the booking FAQ.
 *
 * Availability reflects the real `available` column — there is no fake
 * calendar and no live-inventory indicator that is not reading real data.
 */
export default async function CoachPage({ params }: Props) {
  const { slug } = await params
  const coach = await loadCoach(slug)
  if (!coach || !isLive(coach)) notFound()

  const [{ organization }, similar, faqs] = await Promise.all([
    getSettings(),
    prisma.coach
      .findMany({
        where: { ...publishedCoachWhere(), NOT: { id: coach.id }, classId: coach.classId },
        orderBy: { displayOrder: 'asc' },
        take: 3,
        include: { class: true, images: { orderBy: { order: 'asc' }, take: 1, include: { media: true } } },
      })
      .catch(() => []),
    prisma.faqItem
      .findMany({ where: { group: 'fleet', status: 'PUBLISHED' }, orderBy: { order: 'asc' }, take: 8 })
      .catch(() => []),
  ])

  const price = formatPrice(coach.dailyPrice, coach.currency)
  const amenities = Array.isArray(coach.amenities) ? (coach.amenities as string[]) : []
  const hero = coach.images[0]?.media
  const gallery = coach.images.slice(1)

  const specs: { term: string; value: string }[] = [
    { term: 'Class', value: coach.class?.name ?? 'Unclassified' },
    { term: 'Chassis', value: coach.chassis },
    { term: 'Bunks', value: `${coach.bunks}` },
    { term: 'Slide-outs', value: coach.slideOuts },
    { term: 'Rear configuration', value: coach.rearConfig },
    { term: 'Daily rate', value: price ? `${price} per day` : 'Quoted per tour' },
    { term: 'Availability', value: coach.available ? 'Available for booking' : 'Currently on contract' },
    { term: 'Driver', value: 'CDL-certified driver included' },
  ]

  const graph = await buildGraph(
    [
      await organizationNode(),
      coachNode({
        name: coach.name,
        slug: coach.slug,
        description: coach.description,
        chassis: coach.chassis,
        bunks: coach.bunks,
        slideOuts: coach.slideOuts,
        rearConfig: coach.rearConfig,
        dailyPrice: coach.dailyPrice,
        currency: coach.currency,
        available: coach.available,
        className: coach.class?.name ?? null,
        images: coach.images.map((i) => i.media.path),
      }),
      breadcrumbNode([
        { name: 'Home', url: '/' },
        { name: 'Fleet', url: '/fleet' },
        { name: coach.name, url: `/fleet/${coach.slug}` },
      ]),
      faqNode(faqs.map((f) => ({ question: f.question, answer: f.answer }))),
    ],
    { type: 'COACH', id: coach.id },
  )

  return (
    <>
      <JsonLd data={graph} />

      <article>
        {/* ABOVE FOLD — gallery, identity, price, availability, spec, CTA */}
        <Section base={{ background: 'surface', spacing: 'md', align: 'left', anchor: '', className: 'pt-32 md:pt-36' }}>
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex flex-wrap items-center gap-2 text-step--1 text-muted">
              <li>
                <SmartLink href="/" className="hover:text-primary">
                  Home
                </SmartLink>
              </li>
              <li aria-hidden>/</li>
              <li>
                <SmartLink href="/fleet" className="hover:text-primary">
                  Fleet
                </SmartLink>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="font-semibold text-ink">
                {coach.name}
              </li>
            </ol>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
            <div>
              {hero ? (
                <figure>
                  <SmartImage
                    image={{
                      src: hero.path,
                      alt: hero.alt || `${coach.name}, a ${coach.chassis} entertainer coach`,
                      width: hero.width ?? 1024,
                      height: hero.height ?? 691,
                      caption: '',
                      decorative: false,
                    }}
                    className="w-full rounded-block object-cover shadow-card"
                    priority
                    sizes="(max-width: 1024px) 100vw, 55vw"
                  />
                  <figcaption className="mt-3 text-step--1 text-subtle">
                    {coach.name} — {coach.chassis}, {coach.bunks} bunks, {coach.slideOuts.toLowerCase()},{' '}
                    {coach.rearConfig.toLowerCase()}.
                  </figcaption>
                </figure>
              ) : null}

              {gallery.length ? (
                <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {gallery.map((item) => (
                    <li key={item.id}>
                      <figure>
                        <SmartImage
                          image={{
                            src: item.media.path,
                            alt: item.media.alt || `${coach.name} interior`,
                            width: item.media.width ?? 600,
                            height: item.media.height ?? 400,
                            caption: '',
                            decorative: false,
                          }}
                          className="aspect-[4/3] w-full rounded-card object-cover"
                          sizes="(max-width: 640px) 50vw, 20vw"
                        />
                        {item.caption ? (
                          <figcaption className="mt-2 text-step--1 text-subtle">{item.caption}</figcaption>
                        ) : null}
                      </figure>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                {coach.class ? (
                  <span className="rounded-pill bg-primary-soft px-3.5 py-1.5 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-primary">
                    {coach.class.name} class
                  </span>
                ) : null}
                {coach.tagline ? (
                  <span className="rounded-pill bg-surface-alt px-3.5 py-1.5 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-muted">
                    {coach.tagline}
                  </span>
                ) : null}
              </div>

              <h1 className="mt-4">{coach.name}</h1>
              <p className="mt-2 text-step-1 font-semibold text-muted">{coach.chassis} entertainer coach</p>

              <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[2rem] font-extrabold leading-none text-primary">
                  {price ?? 'Quoted per tour'}
                </span>
                {price ? <span className="text-step-0 font-semibold text-muted">per day</span> : null}
              </p>
              <p className="mt-2 flex items-center gap-2.5 text-step--1 font-semibold">
                <span
                  aria-hidden
                  className={`h-2.5 w-2.5 rounded-full ${coach.available ? 'bg-success' : 'bg-subtle'}`}
                />
                {coach.available ? 'Available for booking' : 'Currently on contract — ask about alternatives'}
              </p>

              {/* Spec block as crawlable text. */}
              <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 rounded-card border border-line bg-surface-alt p-6">
                {specs.slice(0, 6).map((spec) => (
                  <div key={spec.term}>
                    <dt className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-subtle">{spec.term}</dt>
                    <dd className="mt-1 font-extrabold">{spec.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-8 flex flex-wrap gap-4">
                <SmartLink href={`/contact-us?coach=${coach.slug}`} className="kc-btn kc-btn-primary">
                  Request {coach.name}
                </SmartLink>
                <a href={telHref(organization.phone)} className="kc-btn kc-btn-outline">
                  <Icon name="phone" className="h-4 w-4" />
                  {formatPhone(organization.phone)}
                </a>
              </div>
            </div>
          </div>
        </Section>

        {/* BELOW FOLD */}
        <Section base={{ background: 'alt', spacing: 'md', align: 'left', anchor: 'specification', className: '' }}>
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <h2>Full specification</h2>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full border-collapse text-step-0">
                  <caption className="sr-only">{coach.name} specification</caption>
                  <tbody>
                    {specs.map((spec) => (
                      <tr key={spec.term}>
                        <th scope="row" className="w-1/2 border border-line bg-surface px-4 py-3 text-left font-bold">
                          {spec.term}
                        </th>
                        <td className="border border-line bg-surface px-4 py-3">{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {amenities.length ? (
                <>
                  <h3 className="mt-10">Onboard amenities</h3>
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                    {amenities.map((amenity) => (
                      <li key={amenity} className="flex items-start gap-3 text-step--1">
                        <Icon name="circle-check" className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                        <span className="text-muted">{amenity}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>

            <div>
              <h2>Layout</h2>
              <p className="mt-5 text-[1.03rem] leading-[1.85] text-muted">{coach.description}</p>
            </div>
          </div>
        </Section>

        {similar.length ? (
          <Section base={{ background: 'surface', spacing: 'md', align: 'left', anchor: 'similar', className: '' }}>
            <SectionHeading
              heading={`Similar ${coach.class?.name ?? ''} coaches`.replace(/\s+/g, ' ')}
              body="Same class, comparable configuration. Every card links to its full specification."
              className="mb-10"
            />
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((item) => {
                const image = item.images[0]?.media
                return (
                  <Card key={item.id} as="li" className="overflow-hidden">
                    <article>
                      <SmartLink href={`/fleet/${item.slug}`}>
                        {image ? (
                          <SmartImage
                            image={{
                              src: image.path,
                              alt: image.alt || `${item.name}, a ${item.chassis} entertainer coach`,
                              width: image.width ?? 800,
                              height: image.height ?? 540,
                              caption: '',
                              decorative: false,
                            }}
                            className="h-48 w-full object-cover"
                            sizes="(max-width: 640px) 100vw, 33vw"
                          />
                        ) : null}
                      </SmartLink>
                      <div className="p-6">
                        <h3>
                          <SmartLink href={`/fleet/${item.slug}`} className="hover:text-primary">
                            {item.name}
                          </SmartLink>
                        </h3>
                        <dl className="mt-3 space-y-1 text-step--1 text-muted">
                          <div className="flex gap-2">
                            <dt className="font-semibold">Chassis:</dt>
                            <dd>{item.chassis}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-semibold">Bunks:</dt>
                            <dd>{item.bunks}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-semibold">Rear:</dt>
                            <dd>{item.rearConfig}</dd>
                          </div>
                        </dl>
                      </div>
                    </article>
                  </Card>
                )
              })}
            </ul>
          </Section>
        ) : null}

        {faqs.length ? (
          <Section base={{ background: 'alt', spacing: 'md', align: 'left', anchor: 'faq', className: '' }}>
            <SectionHeading heading="Booking questions" eyebrow="FAQ" className="mb-10" />
            <div className="max-w-3xl">
              <FaqAccordionClient
                items={faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer }))}
              />
            </div>
          </Section>
        ) : null}
      </article>
    </>
  )
}
