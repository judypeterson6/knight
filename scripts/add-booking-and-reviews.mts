/**
 * Builds the reservation and reviews pages, and the header actions that reach
 * them.
 *
 *   npx tsx scripts/add-booking-and-reviews.mts
 *
 * Until now the only way to start a booking was the quote form embedded in the
 * home hero or the contact page, so "Book Now" on a fleet card had nowhere of
 * its own to go. This creates:
 *
 *   /reservation  the booking page. It hosts the existing quote-request form
 *                 rather than a second, competing one, so submissions keep
 *                 arriving through the same route, validation and notification
 *                 email that already work.
 *   /reviews      the client reviews already published on the site, gathered
 *                 onto one page and linked from the footer.
 *
 * It also adds a `coach` field to the quote form, populated from the fleet, so
 * "Book Prowler" can arrive with Prowler already selected. The options are read
 * from the database at run time, which means re-running this after a fleet
 * change keeps the list honest.
 *
 * The two header buttons are menu rows with isCta set, not markup, so their
 * labels and destinations stay editable from /admin.
 */

import { withDb } from './_db.mts'
import { blockSchemas } from '../src/lib/blocks/schema'

type Prisma = Parameters<Parameters<typeof withDb>[0]>[0]

const HERO_IMAGE = {
  src: '/uploads/2026/05/Prowler-Entertainer-Coach-1-1024x691.webp',
  alt: 'A Knights Coaches Prevost entertainer coach ready for a tour departure',
  width: 1024,
  height: 691,
  caption: '',
  decorative: false,
}

/** Replaces a page's blocks wholesale so a re-run is idempotent. */
async function writePage(
  prisma: Prisma,
  page: { path: string; slug: string; title: string; pageType: string },
  blocks: { type: string; props: unknown }[],
  seo: { title: string; description: string },
) {
  const row = await prisma.page.upsert({
    where: { path: page.path },
    create: { ...page, status: 'PUBLISHED', publishedAt: new Date() },
    update: { title: page.title, pageType: page.pageType, status: 'PUBLISHED' },
  })

  await prisma.pageBlock.deleteMany({ where: { pageId: row.id } })
  for (const [i, b] of blocks.entries()) {
    await prisma.pageBlock.create({
      data: { pageId: row.id, type: b.type, order: i, visible: true, props: b.props as object },
    })
  }

  const existing = await prisma.seoMeta.findFirst({ where: { entityType: 'PAGE', entityId: row.id } })
  if (existing) {
    await prisma.seoMeta.update({ where: { id: existing.id }, data: seo })
  } else {
    await prisma.seoMeta.create({ data: { entityType: 'PAGE', entityId: row.id, ...seo } })
  }

  console.log(`   ${page.path.padEnd(14)} ${blocks.length} blocks  (title ${seo.title.length}c, desc ${seo.description.length}c)`)
  return row
}

await withDb(async (prisma) => {
  const coaches = await prisma.coach.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { displayOrder: 'asc' },
    select: { name: true },
  })
  const coachNames = coaches.map((c) => c.name)

  // ---------------------------------------------------------------- form ---
  const form = await prisma.form.findUnique({ where: { slug: 'quote-request' } })
  if (!form) throw new Error('quote-request form is missing')

  // Sits directly after the dates, before the contact details, so the visitor
  // confirms what they clicked before typing anything.
  await prisma.formField.upsert({
    where: { formId_name: { formId: form.id, name: 'coach' } },
    create: {
      formId: form.id,
      name: 'coach',
      label: 'Coach you are interested in',
      type: 'SELECT',
      required: false,
      options: ['No preference, recommend one', ...coachNames],
      helpText: 'Leave this on "no preference" and we will match a coach to your routing and crew size.',
      order: 45,
      step: 1,
      halfWidth: true,
    },
    update: { options: ['No preference, recommend one', ...coachNames] },
  })
  console.log(`\n  quote-request: coach field offers ${coachNames.length} coaches`)

  // --------------------------------------------------------- reservation ---
  console.log('\n  pages:')

  await writePage(
    prisma,
    { path: '/reservation', slug: 'reservation', title: 'Online Reservation', pageType: 'service' },
    [
      {
        type: 'Hero',
        props: blockSchemas.Hero.parse({
          background: 'none',
          spacing: 'none',
          eyebrow: 'Online reservation',
          heading: 'Reserve your entertainer coach',
          headingLevel: 'h1',
          body:
            'Send your routing and dates and a dispatcher comes back with the coaches that fit, each priced against your schedule. ' +
            'Every reservation is confirmed by a person, so nothing is booked until you have seen the coach, the rate and the driver plan in writing.',
          variant: 'page',
          image: HERO_IMAGE,
          breadcrumbLabel: 'Home / Online reservation',
          phoneLabel: 'Dispatch',
        }),
      },
      {
        type: 'QuoteForm',
        props: blockSchemas.QuoteForm.parse({
          background: 'surface',
          spacing: 'lg',
          align: 'center',
          anchor: 'booking-form',
          eyebrow: 'Reservation request',
          heading: 'Tell us about your tour',
          headingLevel: 'h2',
          body: 'The more of the routing you can give us, the tighter the quote comes back. Nothing here commits you to a booking.',
          formSlug: 'quote-request',
          showPhone: true,
          phoneLabel: 'Prefer to talk it through? Call',
        }),
      },
      {
        type: 'StepsHowItWorks',
        props: blockSchemas.StepsHowItWorks.parse({
          background: 'alt',
          spacing: 'lg',
          align: 'center',
          eyebrow: 'What happens next',
          heading: 'From request to departure',
          headingLevel: 'h2',
          body: 'Four steps, each handled by a dispatcher rather than an automated queue.',
          items: [
            {
              icon: 'bus',
              title: 'Select your coach',
              description:
                'Send your dates, pickup and drop cities, crew size and floor-plan preference. We match the coach and capacity to the schedule, and say so if a smaller unit would serve you better.',
            },
            {
              icon: 'file-signature',
              title: 'Booking and confirmation',
              description:
                'We come back with the coaches from the fleet that fit, each priced with the daily rate, the fuel basis, a deadhead estimate and a one-driver-or-two recommendation for your mileage.',
            },
            {
              icon: 'credit-card',
              title: 'Deposit and contract',
              description:
                'A deposit and a signed contract confirm the reservation. Costs are itemised up front, including anything that would only apply if the routing changes mid-tour.',
            },
            {
              icon: 'route',
              title: 'Departure day',
              description:
                'The coach arrives prepped, fuelled and checked, with a CDL-certified driver who has the day sheet. Dispatch stays reachable around the clock for the length of the run.',
            },
          ],
        }),
      },
      {
        type: 'FeatureGrid',
        props: blockSchemas.FeatureGrid.parse({
          background: 'surface',
          spacing: 'lg',
          align: 'center',
          eyebrow: 'Before you send it',
          heading: 'What makes a quote accurate',
          headingLevel: 'h2',
          body: 'None of these are required to ask, but each one removes a round trip from the conversation.',
          columns: 4,
          items: [
            {
              icon: 'calendar-days',
              title: 'Dates, including the load-in',
              description:
                'The first and last day the coach is needed, not just the show dates. Bus call the night before a first date is common and it changes the quote.',
            },
            {
              icon: 'route',
              title: 'The routing, roughly',
              description:
                'City pairs matter more than exact mileage. A long overnight leg decides whether the run needs a second driver, which is the single biggest cost variable.',
            },
            {
              icon: 'users',
              title: 'How many are travelling',
              description:
                'Crew size against a twelve-bunk coach tells us whether one coach covers the party or whether a second unit is the cheaper answer.',
            },
            {
              icon: 'truck',
              title: 'Whether gear travels too',
              description:
                'If the production moves with you, quoting the coach and the trucking together is usually cheaper than booking them from two suppliers.',
            },
          ],
        }),
      },
      {
        type: 'FaqAccordion',
        props: blockSchemas.FaqAccordion.parse({
          background: 'alt',
          spacing: 'lg',
          eyebrow: 'Reservation questions',
          heading: 'Questions about booking',
          headingLevel: 'h2',
          group: 'booking-process',
          limit: 12,
          layout: 'split',
          supportTitle: 'Still deciding?',
          supportBody: 'A dispatcher can talk through routing and coach choice before you commit to anything.',
          supportPhoneLabel: 'Call dispatch',
        }),
      },
      {
        type: 'CtaBanner',
        props: blockSchemas.CtaBanner.parse({
          background: 'primary',
          spacing: 'lg',
          align: 'center',
          heading: 'Prefer to see the coaches first?',
          headingLevel: 'h2',
          body: 'Every coach in the fleet, with its layout and photographs.',
          ctas: [{ label: 'Browse the fleet', url: '/fleet', style: 'primary' }],
        }),
      },
    ],
    {
      title: 'Online Reservation | Book an Entertainer Coach',
      description:
        'Reserve a Prevost entertainer coach. Send your tour dates and routing and a dispatcher returns coach options priced against your schedule.',
    },
  )

  // ------------------------------------------------------------- reviews ---
  const reviewCount = await prisma.testimonial.count({ where: { status: 'PUBLISHED' } })

  await writePage(
    prisma,
    { path: '/reviews', slug: 'reviews', title: 'Client Reviews', pageType: 'service' },
    [
      {
        type: 'Hero',
        props: blockSchemas.Hero.parse({
          background: 'none',
          spacing: 'none',
          eyebrow: 'Client reviews',
          heading: 'What touring clients say about Knights Coaches',
          headingLevel: 'h1',
          body:
            'Reviews from artists, tour managers and corporate groups who have run with our coaches. ' +
            'Each one is published as it was given, with the name and role of the person who wrote it.',
          variant: 'page',
          image: HERO_IMAGE,
          breadcrumbLabel: 'Home / Reviews',
          phoneLabel: 'Dispatch',
        }),
      },
      {
        type: 'Testimonials',
        props: blockSchemas.Testimonials.parse({
          background: 'surface',
          spacing: 'lg',
          align: 'center',
          eyebrow: 'In their words',
          heading: 'Reviews from the road',
          headingLevel: 'h2',
          body: 'Every review below is from a client who has travelled with the fleet.',
          limit: 24,
        }),
      },
      {
        type: 'FeatureGrid',
        props: blockSchemas.FeatureGrid.parse({
          background: 'alt',
          spacing: 'lg',
          align: 'center',
          eyebrow: 'What clients raise most',
          heading: 'The things that come up again and again',
          headingLevel: 'h2',
          body: 'The same four points run through the feedback, and they are the four the operation is built around.',
          columns: 4,
          items: [
            {
              icon: 'headset',
              title: 'Someone answers',
              description:
                'Dispatch is staffed around the clock, so a routing change at two in the morning reaches a person who can act on it rather than a ticket queue.',
            },
            {
              icon: 'id-card',
              title: 'The drivers',
              description:
                'CDL with a passenger endorsement, a current DOT medical card and at least three years on entertainer coaches, so the driver knows venue yards and bus call.',
            },
            {
              icon: 'bus',
              title: 'The coach arrives ready',
              description:
                'Mechanical, fluid and tire checks before every pickup, on a Prevost-only fleet, so one parts inventory and one skill set covers every unit.',
            },
            {
              icon: 'file-signature',
              title: 'The number holds',
              description:
                'Rates are itemised at quote, including what would change if the routing moves, so the invoice matches what was agreed.',
            },
          ],
        }),
      },
      {
        type: 'CtaBanner',
        props: blockSchemas.CtaBanner.parse({
          background: 'primary',
          spacing: 'lg',
          align: 'center',
          heading: 'Ready to book your coach?',
          headingLevel: 'h2',
          body: 'Send your dates and routing and a dispatcher will come back with coaches that fit.',
          ctas: [{ label: 'Start a reservation', url: '/reservation', style: 'primary' }],
        }),
      },
    ],
    {
      title: 'Client Reviews | Knights Coaches Tour Bus Rental',
      description:
        'Reviews from artists, tour managers and corporate groups who have toured with Knights Coaches Prevost entertainer coaches.',
    },
  )
  console.log(`   /reviews renders ${reviewCount} published reviews`)

  // --------------------------------------------------------------- menus ---
  const header = await prisma.menu.findUnique({ where: { slug: 'header' }, include: { items: true } })
  if (header) {
    const maxOrder = Math.max(0, ...header.items.map((i) => i.order))
    const ctas = [
      { label: 'Rent a bus', url: '/fleet' },
      { label: 'Online reservation', url: '/reservation' },
    ]
    for (const [i, c] of ctas.entries()) {
      const existing = header.items.find((x) => x.label === c.label || x.url === c.url)
      if (existing) {
        await prisma.menuItem.update({ where: { id: existing.id }, data: { ...c, isCta: true, visible: true } })
      } else {
        await prisma.menuItem.create({
          data: { menuId: header.id, kind: 'CUSTOM', ...c, isCta: true, order: maxOrder + 1 + i, visible: true },
        })
      }
    }
    console.log(`\n  header: ${ctas.map((c) => `"${c.label}" -> ${c.url}`).join(', ')}`)
  }

  const footer = await prisma.menu.findUnique({ where: { slug: 'footer' }, include: { items: true } })
  if (footer) {
    // Column 1 is "Quick links". Its links are stored as children of that
    // heading row, so a new item without the same parent renders nowhere.
    const quick = footer.items.filter((i) => i.column === 1)
    const head = quick.find((i) => !i.parentId && (!i.url || i.url === '#'))
    const parentId = head?.id ?? quick.find((i) => i.parentId)?.parentId ?? null
    const at = Math.max(0, ...quick.map((i) => i.order))
    const links = [
      { label: 'Reviews', url: '/reviews' },
      { label: 'Online reservation', url: '/reservation' },
    ]
    for (const [i, l] of links.entries()) {
      const existing = footer.items.find((x) => x.url === l.url)
      if (existing) {
        await prisma.menuItem.update({ where: { id: existing.id }, data: { ...l, parentId, visible: true } })
      } else {
        await prisma.menuItem.create({
          data: { menuId: footer.id, kind: 'CUSTOM', ...l, column: 1, parentId, order: at + 1 + i, visible: true },
        })
      }
    }
    console.log(`  footer: added ${links.map((l) => l.label).join(', ')} to column 1`)
  }

  console.log('')
})
