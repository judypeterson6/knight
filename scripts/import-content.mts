/**
 * Publishes finished SEO copy from content-output/*.md into real pages.
 *
 *   npx tsx scripts/import-content.mts
 *
 * Each markdown file becomes a Page with a proper block list rather than one
 * lump of HTML, so every section stays editable from /admin and from the
 * front-end editor. The mapping is:
 *
 *   H1 + opening paragraphs  -> Hero (landing variant, quote form in view)
 *   each H2 section          -> RichText, image alternating left/right
 *   the FAQ H2 and its H3s   -> FaqItem rows + a FaqAccordion block
 *   the closing H2           -> CtaBanner
 *
 * FAQs go into FaqItem rather than into the block's HTML because the FAQPage
 * JSON-LD is generated from those rows. Writing them as prose would render the
 * same text with no structured data behind it.
 *
 * Idempotent: pages, blocks, FAQs and SEO rows all upsert on a natural key, so
 * re-running updates in place instead of duplicating.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient, type ContentStatus } from '@prisma/client'
import { blockSchemas, type BlockType } from '../src/lib/blocks/schema'

const prisma = new PrismaClient()
const ROOT = path.resolve(process.cwd())
const DIR = path.join(ROOT, 'content-output')

interface PageSpec {
  file: string
  path: string
  slug: string
  title: string
  pageType: string
  seoTitle: string
  seoDescription: string
  faqGroup: string
  heroAlt: string
}

const PAGES: PageSpec[] = [
  {
    file: 'entertainer-coach-rental.md',
    path: '/entertainer-coach-rental',
    slug: 'entertainer-coach-rental',
    title: 'Entertainer Coach Rental',
    pageType: 'service',
    seoTitle: 'Entertainer Coach Rental: Nationwide Tour Bus Leasing',
    seoDescription:
      'Rent an entertainer coach anywhere in the USA. Prevost sleeper buses with 6 to 14 bunks, lounges, galley and CDL driver. Get a tour quote today.',
    faqGroup: 'entertainer-coach-rental',
    heroAlt: 'Prevost entertainer coach parked outside a US concert venue at night',
  },
  {
    file: 'entertainer-coach-long-term-leasing.md',
    path: '/entertainer-coach-rental/long-term-leasing',
    slug: 'long-term-leasing',
    title: 'Entertainer Coach Leasing',
    pageType: 'service',
    seoTitle: 'Entertainer Coach Leasing: Long-Term Tour Contracts',
    seoDescription:
      'Lease an entertainer coach for a full tour leg, season or year. Fixed monthly rates, dedicated driver and maintenance included. Request terms.',
    faqGroup: 'long-term-leasing',
    heroAlt: 'Touring artist boarding a leased entertainer coach on a multi-month run',
  },
  {
    file: 'how-to-book-an-entertainer-coach.md',
    path: '/entertainer-coach-rental/booking-process',
    slug: 'booking-process',
    title: 'How to Book an Entertainer Coach',
    pageType: 'service',
    seoTitle: 'How to Book an Entertainer Coach: Step-by-Step',
    seoDescription:
      'Booking a tour bus takes five steps: itinerary, headcount, coach spec, quote, contract. See exactly what a coach company needs from you.',
    faqGroup: 'booking-process',
    heroAlt: 'Tour manager reviewing an itinerary before booking an entertainer coach',
  },
  {
    file: 'tour-bus-pricing-models.md',
    path: '/entertainer-coach-rental/pricing-models',
    slug: 'pricing-models',
    title: 'Tour Bus Pricing Models',
    pageType: 'service',
    seoTitle: 'Tour Bus Pricing Models: Day, Week or Full Tour',
    seoDescription:
      'Compare day-rate, weekly and full-tour entertainer coach pricing to see which structure costs least for your routing and number of shows.',
    faqGroup: 'pricing-models',
    heroAlt: 'Comparison of daily and full-tour entertainer coach lease rates',
  },
  {
    file: 'entertainer-coach-rental-cost.md',
    path: '/entertainer-coach-rental/cost',
    slug: 'cost',
    title: 'Entertainer Coach Rental Cost',
    pageType: 'service',
    seoTitle: 'Entertainer Coach Rental Cost: 2026 Price Guide',
    seoDescription:
      'Entertainer coach day rates typically run several hundred to a few thousand dollars plus driver and fuel. See the full cost breakdown.',
    faqGroup: 'rental-cost',
    heroAlt: 'Cost breakdown chart for renting an entertainer coach in the USA',
  },
  {
    file: 'entertainer-coach-fleet.md',
    path: '/entertainer-coach-fleet',
    slug: 'entertainer-coach-fleet',
    title: 'Entertainer Coach Fleet',
    pageType: 'service',
    seoTitle: 'Entertainer Coach Fleet: Floor Plans and Bunk Counts',
    seoDescription:
      'Browse entertainer coach layouts from 6-bunk star coaches to 14-bunk crew buses, with slide-out and non-slide options. Compare and request.',
    faqGroup: 'coach-fleet',
    heroAlt: 'Interior floor plan layouts of entertainer coaches with bunks and lounges',
  },
  {
    file: '12-bunk-entertainer-coach.md',
    path: '/entertainer-coach-fleet/12-bunk',
    slug: '12-bunk',
    title: '12-Bunk Entertainer Coach',
    pageType: 'service',
    seoTitle: '12-Bunk Entertainer Coach Rental for Bands and Crew',
    seoDescription:
      'The touring workhorse: 12 bunks, front and rear lounges, galley and full bath. Sleeps a band plus crew on one bus. Check availability.',
    faqGroup: '12-bunk',
    heroAlt: 'Bunk alley of a 12-bunk entertainer coach with privacy curtains',
  },
  {
    file: 'prevost-entertainer-coach.md',
    path: '/prevost-entertainer-coach',
    slug: 'prevost-entertainer-coach',
    title: 'Prevost Entertainer Coach',
    pageType: 'service',
    seoTitle: 'Prevost Entertainer Coach Rental: X3-45 and H3-45',
    seoDescription:
      'Prevost is the US touring standard. Compare X3-45, H3-45 and XLII entertainer conversions available for lease nationwide.',
    faqGroup: 'prevost-chassis',
    heroAlt: 'Prevost entertainer coach shell used for touring conversions',
  },
  {
    file: 'band-tour-bus-rental.md',
    path: '/who-we-serve/bands-musicians',
    slug: 'bands-musicians',
    title: 'Band Tour Bus Rental',
    pageType: 'service',
    seoTitle: 'Band Tour Bus Rental: Sleeper Coaches for Musicians',
    seoDescription:
      'Sleeper coaches built for the grind: bunks for the band, gear bays, galley and a driver who knows load-in times. Get a routing quote.',
    faqGroup: 'bands-musicians',
    heroAlt: 'Band loading instruments into the bays of a tour bus',
  },
  {
    file: 'nashville-entertainer-coach-rental.md',
    path: '/entertainer-coach-rental/nashville',
    slug: 'nashville',
    title: 'Nashville Entertainer Coach Rental',
    pageType: 'location',
    seoTitle: 'Nashville Entertainer Coach Rental: Tour Bus Leasing',
    seoDescription:
      'Nashville is the center of the US touring coach industry. Lease a Prevost entertainer coach out of Music City for any national routing.',
    faqGroup: 'nashville',
    heroAlt: 'Entertainer coach on Broadway in downtown Nashville',
  },
  {
    file: 'entertainer-coach-rental-agreement.md',
    path: '/entertainer-coach-rental/rental-agreement',
    slug: 'rental-agreement',
    title: 'Entertainer Coach Rental Agreement',
    pageType: 'service',
    seoTitle: 'Entertainer Coach Rental Agreement Explained',
    seoDescription:
      'What a tour bus lease contract covers: term, mileage, fuel, driver, damage, indemnity and insurance clauses. Read before you sign.',
    faqGroup: 'rental-agreement',
    heroAlt: 'Signed entertainer coach lease agreement on a desk with a tour itinerary',
  },
]

// --- markdown parsing -------------------------------------------------------

interface Section {
  heading: string
  /** Raw markdown lines belonging to this section. */
  lines: string[]
}

interface Parsed {
  h1: string
  intro: string[]
  sections: Section[]
}

function parse(md: string): Parsed {
  const lines = md.split('\n')
  let h1 = ''
  const intro: string[] = []
  const sections: Section[] = []
  let current: Section | null = null

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.startsWith('# ')) {
      h1 = line.slice(2).trim()
      continue
    }
    if (line.startsWith('## ')) {
      current = { heading: line.slice(3).trim(), lines: [] }
      sections.push(current)
      continue
    }
    if (current) current.lines.push(line)
    else if (line.trim()) intro.push(line.trim())
  }
  return { h1, intro, sections }
}

/** Inline markdown to HTML: bold only, which is all the copy uses. */
function inline(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

/** Block markdown to HTML: paragraphs and bullet lists. */
function toHtml(lines: string[]): string {
  const out: string[] = []
  let list: string[] = []

  const flush = () => {
    if (!list.length) return
    out.push(`<ul>${list.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`)
    list = []
  }

  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (t.startsWith('- ')) {
      list.push(t.slice(2))
      continue
    }
    flush()
    if (t.startsWith('### ')) out.push(`<h3>${inline(t.slice(4))}</h3>`)
    else out.push(`<p>${inline(t)}</p>`)
  }
  flush()
  return out.join('')
}

/** The first two sentences, for the hero standfirst. */
function lead(text: string, max = 2): string {
  const parts = text.replace(/\*\*/g, '').match(/[^.!?]+[.!?]+/g) ?? [text]
  return parts.slice(0, max).join(' ').trim()
}

/** Splits an FAQ section into question/answer pairs. */
function faqPairs(lines: string[]): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = []
  let q = ''
  let a: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('### ')) {
      if (q) out.push({ question: q, answer: a.join(' ').trim() })
      q = t.slice(4).trim()
      a = []
      continue
    }
    if (t) a.push(t.replace(/\*\*/g, ''))
  }
  if (q) out.push({ question: q, answer: a.join(' ').trim() })
  return out
}

function slugify(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 190)
}

/** Validates against the real block schema, so nothing unrenderable is written. */
function block(type: BlockType, props: Record<string, unknown>) {
  return { type, props: blockSchemas[type].parse(props) as object }
}

// --- import -----------------------------------------------------------------

async function main() {
  console.log('\n  Publishing content-output/*.md\n')

  // Reuse real migrated imagery rather than referencing files that do not exist.
  const heroPool = await prisma.media.findMany({
    where: { path: { contains: '/uploads/' }, mimeType: { in: ['image/jpeg', 'image/png', 'image/webp'] } },
    orderBy: { bytes: 'desc' },
    take: 40,
    select: { path: true, width: true, height: true, alt: true },
  })
  const usable = heroPool.filter((m) => (m.width ?? 0) >= 900)

  for (const [index, spec] of PAGES.entries()) {
    const md = readFileSync(path.join(DIR, spec.file), 'utf8')
    const { h1, intro, sections } = parse(md)

    const faqSection = sections.find((s) => /frequently asked questions/i.test(s.heading))
    const closing = sections[sections.length - 1]
    const bodySections = sections.filter((s) => s !== faqSection && s !== closing)

    const hero = usable[index % Math.max(usable.length, 1)]
    const blocks: { type: BlockType; props: object }[] = []

    // Hero
    blocks.push(
      block('Hero', {
        variant: 'landing',
        background: 'none',
        spacing: 'none',
        headingLevel: 'h1',
        eyebrow: spec.title,
        heading: h1,
        body: lead(intro[0] ?? ''),
        image: hero
          ? { src: hero.path, alt: spec.heroAlt, width: hero.width ?? 1600, height: hero.height ?? 1000, caption: '', decorative: false }
          : {},
        breadcrumbLabel: `Home / ${spec.title}`,
        phoneLabel: '24/7 dispatch',
        ctas: [{ label: 'Explore the fleet', url: '/fleet', style: 'ghost' }],
        showQuoteForm: true,
        quoteFormSlug: 'quote-request',
        quoteFormTitle: 'Get a quote',
      }),
    )

    // The rest of the intro keeps its role as the page's opening brief.
    if (intro.length > 1) {
      blocks.push(
        block('RichText', {
          background: 'surface',
          spacing: 'md',
          maxWidth: 'prose',
          html: toHtml(intro.slice(1)),
        }),
      )
    }

    // Body sections, image alternating so the page is not a wall of text.
    for (const [i, section] of bodySections.entries()) {
      const img = usable[(index * 5 + i + 1) % Math.max(usable.length, 1)]
      const withImage = i % 2 === 0 && Boolean(img)
      blocks.push(
        block('RichText', {
          background: i % 2 === 0 ? 'surface' : 'alt',
          spacing: 'md',
          heading: section.heading,
          headingLevel: 'h2',
          html: toHtml(section.lines),
          imagePosition: withImage ? (i % 4 === 0 ? 'right' : 'left') : 'none',
          image: withImage
            ? { src: img.path, alt: img.alt || `${section.heading} — Knights Coaches`, width: img.width ?? 1200, height: img.height ?? 800, caption: '', decorative: false }
            : {},
        }),
      )
    }

    // FAQs into their own rows so the FAQPage schema has something to read.
    let faqCount = 0
    if (faqSection) {
      const pairs = faqPairs(faqSection.lines)
      faqCount = pairs.length
      for (const [i, pair] of pairs.entries()) {
        const slug = `${spec.faqGroup}-${slugify(pair.question)}`.slice(0, 200)
        await prisma.faqItem.upsert({
          where: { slug },
          create: {
            slug,
            question: pair.question,
            answer: pair.answer,
            group: spec.faqGroup,
            order: i,
            status: 'PUBLISHED' as ContentStatus,
            publishedAt: new Date(),
          },
          update: { question: pair.question, answer: pair.answer, order: i, group: spec.faqGroup },
        })
      }
      blocks.push(
        block('FaqAccordion', {
          background: 'alt',
          spacing: 'md',
          eyebrow: 'Got questions?',
          heading: 'Frequently asked questions',
          group: spec.faqGroup,
          limit: 20,
          layout: 'split',
          supportTitle: 'Still have questions?',
          supportBody: 'Dispatch answers 24 hours a day and can price a routing on the call.',
          supportPhoneLabel: 'Call',
        }),
      )
    }

    // Closing section becomes the conversion banner.
    if (closing) {
      const text = closing.lines.filter((l) => l.trim()).map((l) => l.replace(/\*\*/g, '').trim())
      blocks.push(
        block('CtaBanner', {
          background: 'primary',
          spacing: 'md',
          align: 'center',
          heading: closing.heading,
          headingLevel: 'h2',
          body: text.join(' '),
          ctas: [
            { label: 'Request a quote', url: '/contact-us', style: 'primary' },
            { label: 'See the fleet', url: '/fleet', style: 'ghost' },
          ],
        }),
      )
    }

    // --- write the page ----------------------------------------------------
    const page = await prisma.page.upsert({
      where: { path: spec.path },
      create: {
        path: spec.path,
        slug: spec.slug,
        title: spec.title,
        pageType: spec.pageType,
        status: 'PUBLISHED' as ContentStatus,
        publishedAt: new Date(),
      },
      update: { title: spec.title, status: 'PUBLISHED' as ContentStatus, pageType: spec.pageType },
    })

    await prisma.pageBlock.deleteMany({ where: { pageId: page.id } })
    await prisma.pageBlock.createMany({
      data: blocks.map((b, order) => ({ pageId: page.id, type: b.type, order, visible: true, props: b.props })),
    })

    await prisma.seoMeta.upsert({
      where: { entityType_entityId: { entityType: 'PAGE', entityId: page.id } },
      create: {
        entityType: 'PAGE',
        entityId: page.id,
        title: spec.seoTitle,
        description: spec.seoDescription,
        canonical: spec.path,
        robots: 'INDEX_FOLLOW',
      },
      update: { title: spec.seoTitle, description: spec.seoDescription, canonical: spec.path },
    })

    console.log(`  ${spec.path.padEnd(46)} ${blocks.length} blocks, ${faqCount} FAQs`)
  }

  console.log('\n  Done. Clear .next/cache or save from /admin to refresh the ISR cache.\n')
  await prisma.$disconnect()
}

await main()
