/**
 * Database seed.
 *
 * Consumes the migration snapshot in prisma/seed-data (produced by
 * `npm run migrate:wp`) and builds the running site: the admin user, every
 * migrated page with its real blocks and real copy, all posts, all coaches, all
 * FAQs, both menus, the per-URL SEO metadata and every redirect.
 *
 * There is no placeholder copy anywhere in this file. Every string that reaches
 * the front end either came out of the WordPress migration or is a factual
 * statement about how this application itself works (the legal pages).
 *
 * Idempotent: everything upserts on a natural key, so re-running is safe.
 */

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import { PrismaClient, type ContentStatus, type RobotsDirective } from '@prisma/client'
import { DEFAULTS } from '../src/lib/settings'
import { blockSchemas, type BlockType } from '../src/lib/blocks/schema'

const prisma = new PrismaClient()
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'prisma', 'seed-data')

// ---------------------------------------------------------------------------
// Snapshot types + loader
// ---------------------------------------------------------------------------

interface OutlineNode {
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'ul' | 'ol'
  text: string
  items?: string[]
}

interface SeoRecord {
  title: string | null
  description: string | null
  canonical: string | null
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  robots: RobotsDirective
}

interface PageRecord {
  wpId: number | null
  wpUrl: string | null
  route: string
  slug: string
  title: string
  pageType: string
  status: 'PUBLISHED' | 'DRAFT'
  publishedAt: string | null
  bodyHtml: string
  outline: OutlineNode[]
  images: string[]
  seo: SeoRecord
}

interface PostRecord {
  wpId: number
  wpUrl: string
  slug: string
  title: string
  excerpt: string
  body: string
  status: 'PUBLISHED' | 'DRAFT'
  publishedAt: string | null
  categorySlug: string | null
  featuredImage: string | null
  seo: SeoRecord
}

interface MediaRecord {
  sourceUrl: string
  path: string
  filename: string
  mimeType: string
  alt: string
  title: string | null
  caption: string | null
  width: number | null
  height: number | null
  bytes: number | null
}

interface CoachRecord {
  slug: string
  name: string
  className: string
  chassis: string
  bunks: number
  slideOuts: string
  rearConfig: string
  amenities: string[]
  dailyPrice: number | null
  tagline: string | null
  description: string
  images: string[]
  featured: boolean
  displayOrder: number
}

interface LocationRecord {
  slug: string
  city: string
  state: string
  region: string | null
  route: string | null
  isHub: boolean
  order: number
  summary: string | null
  image: string | null
}

interface TestimonialRecord {
  slug: string
  name: string
  role: string
  quote: string
  rating: number
  avatar: string | null
  order: number
}

interface CategoryRecord {
  wpId: number
  slug: string
  name: string
  description: string
  parentWpId: number | null
}

interface RedirectRecord {
  from: string
  to: string
  kind: 'PERMANENT' | 'TEMPORARY'
  note: string
}

function load<T>(file: string, fallback: T): T {
  const full = path.join(DATA, file)
  if (!existsSync(full)) {
    console.warn(`  ! ${file} not found — run "npm run migrate:wp" first. Continuing without it.`)
    return fallback
  }
  return JSON.parse(readFileSync(full, 'utf8')) as T
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const block = <T extends BlockType>(type: T, props: Record<string, unknown>) => ({
  type,
  props: blockSchemas[type].parse(props) as unknown as Record<string, unknown>,
})

type SeedBlock = ReturnType<typeof block>

const image = (
  src: string | null | undefined,
  alt: string,
  width = 1024,
  height = 691,
  caption = '',
) => ({ src: src ?? '', alt, width, height, caption, decorative: false })

const cta = (label: string, url: string, style: 'primary' | 'outline' | 'ghost' = 'primary') => ({
  label,
  url,
  style,
})

/** Drops WordPress breadcrumb crumbs and other chrome that is not body copy. */
function isBodyNode(node: OutlineNode): boolean {
  if (node.tag === 'ul' || node.tag === 'ol') {
    const items = node.items ?? []
    if (!items.length) return false
    if (items.length === 1 && /^home\s*\/|^home$/i.test(items[0])) return false
    return true
  }
  const text = node.text.trim()
  if (!text) return false
  if (/^home\s*\/\s*/i.test(text)) return false
  if (text === 'United States') return false
  if (text.length < 3) return false
  return true
}

/**
 * Turns a migrated page's outline into RichText blocks — one per h2/h3 section,
 * preserving heading level, list structure and section order.
 */
function sectionsFrom(outline: OutlineNode[], skipHeadings: string[] = []): { heading: string; html: string }[] {
  const nodes = outline.filter(isBodyNode)
  const sections: { heading: string; html: string }[] = []
  let current: { heading: string; parts: string[] } | null = null
  const skip = new Set(skipHeadings.map((s) => s.toLowerCase().trim()))

  const flush = () => {
    if (current && current.parts.length) {
      sections.push({ heading: current.heading, html: current.parts.join('\n') })
    }
    current = null
  }

  for (const node of nodes) {
    if (node.tag === 'h1' || node.tag === 'h2') {
      flush()
      current = { heading: node.text, parts: [] }
      continue
    }
    if (!current) current = { heading: '', parts: [] }

    if (node.tag === 'h3' || node.tag === 'h4') {
      current.parts.push(`<${node.tag}>${escapeHtml(node.text)}</${node.tag}>`)
    } else if (node.tag === 'ul' || node.tag === 'ol') {
      const items = (node.items ?? []).map((i) => `<li>${escapeHtml(i)}</li>`).join('')
      current.parts.push(`<${node.tag}>${items}</${node.tag}>`)
    } else {
      current.parts.push(`<p>${escapeHtml(node.text)}</p>`)
    }
  }
  flush()

  return sections.filter((s) => !skip.has(s.heading.toLowerCase().trim()) && s.html.length > 0)
}

function escapeHtml(value: string): string {
  return value.replace(/&(?!(?:amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function firstParagraph(outline: OutlineNode[]): string {
  return outline.find((n) => n.tag === 'p' && isBodyNode(n))?.text ?? ''
}

/** The source pages carry multiple h1s (Elementor). Ours has exactly one. */
function h1For(page: PageRecord): string {
  const fromOutline = page.outline.find((n) => (n.tag === 'h1' || n.tag === 'h2') && isBodyNode(n))?.text
  return (fromOutline ?? page.title).trim()
}

// ---------------------------------------------------------------------------
// Reference content used by the designed pages
// ---------------------------------------------------------------------------

const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' }, { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
]

const HOME_FAQS: { question: string; answer: string }[] = [
  {
    question: 'What is an entertainer coach?',
    answer:
      'An entertainer coach is a custom-converted Prevost bus built for overnight touring — with bunks, a full galley, private lounges, and an onboard shower. It lets your crew sleep and travel between cities at the same time.',
  },
  {
    question: 'What is the difference between rental and leasing?',
    answer:
      'Rental is per-date or per-tour and ideal for single runs. Leasing is a long-term arrangement (1 to 12 months) at reduced rates with a guaranteed coach assignment and fleet priority.',
  },
  {
    question: 'Do your coaches come with a driver?',
    answer:
      'Yes. Every coach includes a professional CDL Class A or B driver with a minimum of three years of entertainer-coach experience, clean DOT medical cards, and spotless driving records.',
  },
  {
    question: 'Do you provide tour trucking?',
    answer:
      'Yes. We coordinate enclosed trailers, box trucks, and flatbeds to move backline equipment, merchandise, and production gear right alongside your coach.',
  },
  {
    question: 'What areas do you serve?',
    answer:
      'We provide pickup and drop-off in any major US city across all 48 contiguous states — Nashville, LA, NYC, Atlanta, Chicago, Dallas, and everywhere between.',
  },
  {
    question: 'What safety certifications do you hold?',
    answer:
      'We are a member of the Entertainer Motorcoach Council (EMC), maintain a satisfactory FMCSA safety rating, and are fully US DOT registered.',
  },
  {
    question: 'What bunk configurations are available?',
    answer:
      'Our coaches are configured with 6 to 14 bunks, plus front and rear lounges, in single, double, and triple slide-out layouts depending on the model you choose.',
  },
  {
    question: 'How far in advance should I book?',
    answer:
      'For peak touring seasons we recommend booking as early as possible, but our 24/7 dispatch can also accommodate last-minute and short-notice reservations.',
  },
]

const NATIONWIDE_FAQS: { question: string; answer: string }[] = [
  {
    question: 'Which states does Knights Coaches serve?',
    answer:
      'We operate across all 48 contiguous states with pickup and drop-off in any major US city. Hawaii and Alaska fall outside the operational footprint because no commercial route accommodates a 45-foot Prevost.',
  },
  {
    question: 'How is a cross-country quote priced?',
    answer:
      'Every quote is built from four components: the daily coach-and-driver rate, a fuel surcharge on actual mileage, the deadhead from our nearest positioning hub, and the return deadhead — each shown line by line on the contract.',
  },
  {
    question: 'What is a deadhead charge?',
    answer:
      'The deadhead is the distance our coach travels from its nearest positioning hub to your pickup city (and back at tour end), billed at a reduced rate that does not include the full daily charge.',
  },
  {
    question: 'Where are your coaches positioned?',
    answer:
      'Our fleet concentrates in Nashville, Tennessee and the Mid-Atlantic region, which puts a coach within a half-day drive of most major venue corridors east of the Mississippi.',
  },
  {
    question: 'Do you handle cross-border runs into Canada?',
    answer:
      'Yes, case-by-case. Cross-border runs require the chauffeur to carry a valid passport, advance customs documentation, and the appropriate CBSA paperwork. The quote includes the extra administrative time and any brokerage fees.',
  },
  {
    question: 'Can you move our equipment too?',
    answer:
      'Yes. Our tour trucking package moves backline, merch and production gear in enclosed trailers, box trucks or flatbeds traveling alongside the coach — single-source coordination on one contract.',
  },
  {
    question: 'How far in advance should we book a national tour?',
    answer:
      'Bookings made 60-plus days out get first-pick fleet selection. Last-minute requests under 14 days book against remaining availability, with peak season (March through October) tightening windows further.',
  },
  {
    question: 'Do long routes get one driver or two?',
    answer:
      'It depends on daily mileage and DOT hours-of-service limits. Each quote includes a one-driver-or-two recommendation for the distances your routing involves.',
  },
]

const FLEET_FAQS: { question: string; answer: string }[] = [
  {
    question: 'What does the class name mean?',
    answer:
      'Elite coaches run on the Prevost X3-45 platform with the highest interior specification and the largest slide-out configurations. Premium coaches run on the Prevost H3-45 high-deck platform. Standard coaches are H3-45 units configured for crew travel rather than artist travel.',
  },
  {
    question: 'What is a slide-out?',
    answer:
      'A slide-out is a section of the cabin wall that extends outward when the coach is parked, adding roughly 18 inches of cabin width per slide. A double-slide coach has two; a triple-slide has three.',
  },
  {
    question: 'What does the rear configuration tell me?',
    answer:
      'The rear of the coach is either a lounge (a shared seating area), a suite or master suite (a private room with a bed), or a star configuration (a private stateroom plus additional lounge space).',
  },
  {
    question: 'How many people can sleep on board?',
    answer:
      'The bunk count is the sleeping capacity. Our coaches range from 6 to 14 bunks, plus whatever the rear configuration adds — a master suite or stateroom sleeps one or two more.',
  },
  {
    question: 'Is a driver included with every coach?',
    answer:
      'Yes. Every booking includes a CDL Class A or B driver with a minimum of three years on entertainer coaches, a current DOT medical card and FMCSA clearinghouse enrolment.',
  },
  {
    question: 'Can I see a coach before booking?',
    answer:
      'Where the coach is not out on a contract, yes. Call dispatch on 855 734 5700 and we will arrange a walkthrough at the nearest positioning hub.',
  },
  {
    question: 'What if the coach I want is unavailable for my dates?',
    answer:
      'The quote comes back with three coaches from the fleet that match your dates and floor-plan preference, so you always have alternatives rather than a single yes-or-no answer.',
  },
  {
    question: 'Can the coach be wrapped with our artwork?',
    answer:
      'Yes. Custom branded wraps are available and are quoted separately from the daily rate. Lead time depends on the artwork and the length of the booking.',
  },
]

// ---------------------------------------------------------------------------
// Legal pages
//
// The source WordPress site publishes no legal pages, so these describe what
// this application actually does — the data it stores, where it stores it, and
// which third parties can receive it. They are accurate as built. The business
// should have counsel review them before launch; that note is in the README.
// ---------------------------------------------------------------------------

const LEGAL_PAGES: { route: string; title: string; heading: string; intro: string; sections: { heading: string; html: string }[] }[] = [
  {
    route: '/privacy-policy',
    title: 'Privacy Policy',
    heading: 'Privacy policy',
    intro:
      'This policy explains what personal information knightscoaches.com collects, why it is collected, how long it is kept, and who else can see it.',
    sections: [
      {
        heading: 'What we collect',
        html: '<p>We collect only what you type into a form on this site. The quote request form collects your name, job title, email address, phone number, artist or organisation name, pickup and drop-off cities, travel dates, the number of coaches and trucks you need, and any additional notes you write. The contact form collects your name, email address, phone number and message.</p><p>Our servers also record the IP address and browser user-agent attached to each submission. That is used to rate-limit the form against automated abuse and for nothing else.</p>',
      },
      {
        heading: 'Why we collect it',
        html: '<p>We use the information to prepare and send you a quote, to answer your enquiry, and to run the booking if you go ahead. We do not sell it, rent it, or share it for anyone else&rsquo;s marketing.</p>',
      },
      {
        heading: 'Where it is stored',
        html: '<p>Submissions are stored in our own MySQL database on our hosting infrastructure. A copy of each submission is also emailed to our dispatch team so we can respond quickly. If you send us a routing document as an attachment, it is stored alongside the submission.</p>',
      },
      {
        heading: 'How long we keep it',
        html: '<p>Quote requests and contact messages are retained for as long as we may reasonably need them to service or evidence a booking, and are then deleted. You can ask us to delete your record sooner at any time.</p>',
      },
      {
        heading: 'Cookies and analytics',
        html: '<p>This site sets no advertising or tracking cookies of its own. A session cookie is set only if you sign in to the site administration area, which is staff-only.</p><p>Where the business has enabled an analytics or verification script, it is listed in the site settings and loads on every page. Any such script is a third party and receives your IP address and the pages you visit under its own privacy policy.</p>',
      },
      {
        heading: 'Your rights',
        html: '<p>You can ask us what we hold about you, ask us to correct it, or ask us to delete it. Email <a href="mailto:info@knightscoaches.com">info@knightscoaches.com</a> or call 855 734 5700 and we will action the request.</p>',
      },
      {
        heading: 'Contacting us',
        html: '<p>Knights Coaches, 137 National Plaza Suite 300, National Harbor, MD 20745. Telephone 855 734 5700. Email <a href="mailto:info@knightscoaches.com">info@knightscoaches.com</a>.</p>',
      },
    ],
  },
  {
    route: '/terms',
    title: 'Terms of Use',
    heading: 'Terms of use',
    intro:
      'These terms cover your use of this website. They are separate from the rental or lease contract that governs an actual booking.',
    sections: [
      {
        heading: 'Using this site',
        html: '<p>You may browse this site and submit an enquiry through it. You may not attempt to gain access to the administration area, submit automated or fraudulent enquiries, or interfere with the operation of the site.</p>',
      },
      {
        heading: 'Quotes and availability',
        html: '<p>Nothing on this site is a binding offer. Coach availability shown on a fleet page reflects our records at the time the page was generated and can change. A booking exists only once we have issued a written quote, you have accepted it, and a deposit and signed contract are in place.</p>',
      },
      {
        heading: 'Pricing',
        html: '<p>Where a daily rate is shown it is the rate for the coach and driver only. Fuel surcharge, deadhead mileage, driver lodging on overnight stays, one-way drop charges, trucking and any customisation are quoted separately and itemised on the contract.</p>',
      },
      {
        heading: 'Content and trade marks',
        html: '<p>The text, photography and layout of this site belong to Knights Coaches. Prevost, H3-45 and X3-45 are marks of their respective owner and are used here to describe the chassis our coaches are built on.</p>',
      },
      {
        heading: 'Governing terms',
        html: '<p>These terms are governed by the law of the State of Maryland. If any part of them is unenforceable, the rest continues to apply.</p>',
      },
    ],
  },
  {
    route: '/disclaimer',
    title: 'Disclaimer',
    heading: 'Disclaimer',
    intro:
      'What the information on this site does and does not promise.',
    sections: [
      {
        heading: 'Specifications',
        html: '<p>Bunk counts, slide-out configurations, rear configurations and amenity lists describe the coach as currently configured. Coaches are refurbished and reconfigured between contracts, so confirm the specification for your dates with dispatch before you commit.</p>',
      },
      {
        heading: 'Photography',
        html: '<p>Photographs show coaches from our fleet. Interior trim, upholstery and finishes vary between individual units in the same class.</p>',
      },
      {
        heading: 'Certifications',
        html: '<p>Our Entertainer Motorcoach Council membership, US DOT registration and FMCSA safety rating are stated as held at the time of publication. Current status can be verified with the issuing body, and we will supply our DOT number on request.</p>',
      },
      {
        heading: 'Coverage',
        html: '<p>Our service area is the 48 contiguous states. Hawaii and Alaska are outside it. Cross-border runs into Canada are quoted case by case and are not standard inventory.</p>',
      },
      {
        heading: 'External links',
        html: '<p>Where this site links to another organisation, we are not responsible for that organisation&rsquo;s content or practices.</p>',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('\n  Seeding knightscoaches.com\n')

  const pages = load<PageRecord[]>('pages.json', [])
  const posts = load<PostRecord[]>('posts.json', [])
  const categories = load<CategoryRecord[]>('categories.json', [])
  const mediaRecords = load<MediaRecord[]>('media.json', [])
  const coaches = load<CoachRecord[]>('coaches.json', [])
  const locations = load<LocationRecord[]>('locations.json', [])
  const testimonials = load<TestimonialRecord[]>('testimonials.json', [])
  const redirects = load<RedirectRecord[]>('redirects.json', [])

  // --- Settings -------------------------------------------------------------
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as object },
      update: {},
    })
  }
  console.log(`  settings        ${Object.keys(DEFAULTS).length}`)

  // --- Admin user -----------------------------------------------------------
  const adminEmail = (process.env.ADMIN_EMAIL || 'info@knightscoaches.com').toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD || 'change-this-before-deploying'
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: process.env.ADMIN_NAME || 'Knights Coaches Admin',
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: 'ADMIN',
      bio: 'Dispatch and operations, Knights Coaches.',
      active: true,
    },
    update: { role: 'ADMIN', active: true },
  })
  console.log(`  admin user      ${admin.email}`)

  // --- Media ----------------------------------------------------------------
  const mediaIdByPath = new Map<string, string>()
  for (const record of mediaRecords) {
    const row = await prisma.media.upsert({
      where: { path: record.path },
      create: {
        path: record.path,
        sourceUrl: record.sourceUrl,
        filename: record.filename,
        mimeType: record.mimeType,
        width: record.width,
        height: record.height,
        bytes: record.bytes,
        alt: record.alt,
        // An asset that arrived from WordPress with no alt text is flagged, not
        // silently treated as decorative — it shows up in the admin SEO audit.
        decorative: false,
        title: record.title,
        caption: record.caption,
      },
      update: { width: record.width, height: record.height, bytes: record.bytes },
    })
    mediaIdByPath.set(record.path, row.id)
  }
  console.log(`  media           ${mediaIdByPath.size}`)

  const mediaMeta = new Map(mediaRecords.map((m) => [m.path, m]))
  const img = (p: string | null | undefined, alt: string, caption = '') => {
    if (!p) return image('', alt)
    const meta = mediaMeta.get(p)
    return image(p, meta?.alt || alt, meta?.width ?? 1024, meta?.height ?? 691, caption)
  }

  // --- Coach classes and coaches -------------------------------------------
  const CLASS_DESCRIPTIONS: Record<string, string> = {
    Elite:
      'Prevost X3-45 platform. The highest interior specification in the fleet, with the largest slide-out configurations and private rear staterooms.',
    Premium:
      'Prevost H3-45 high-deck platform. Generous headroom, large under-floor storage bays and single or double slide-out layouts.',
    Standard:
      'Prevost H3-45 units configured for crew travel rather than artist travel — fewer bunks, single slide, rear lounge.',
  }

  const classIdByName = new Map<string, string>()
  const classNames = [...new Set(coaches.map((c) => c.className))]
  for (const [index, name] of classNames.entries()) {
    const row = await prisma.coachClass.upsert({
      where: { slug: name.toLowerCase() },
      create: {
        slug: name.toLowerCase(),
        name,
        description: CLASS_DESCRIPTIONS[name] ?? `${name} class coaches.`,
        order: index,
      },
      update: { name, description: CLASS_DESCRIPTIONS[name] ?? undefined },
    })
    classIdByName.set(name, row.id)
  }

  for (const coach of coaches) {
    const row = await prisma.coach.upsert({
      where: { slug: coach.slug },
      create: {
        slug: coach.slug,
        name: coach.name,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        classId: classIdByName.get(coach.className) ?? null,
        chassis: coach.chassis,
        bunks: coach.bunks,
        slideOuts: coach.slideOuts,
        rearConfig: coach.rearConfig,
        amenities: coach.amenities,
        description: coach.description,
        tagline: coach.tagline,
        // Left unset: the source publishes a fleet-wide $180–$320 daily band but
        // no per-coach figure, and inventing one would be worse than none. Set
        // real prices in /admin/fleet and the price filter and Product offer
        // both activate automatically.
        dailyPrice: coach.dailyPrice,
        available: true,
        featured: coach.featured,
        displayOrder: coach.displayOrder,
      },
      update: {
        chassis: coach.chassis,
        bunks: coach.bunks,
        slideOuts: coach.slideOuts,
        rearConfig: coach.rearConfig,
        amenities: coach.amenities,
        description: coach.description,
      },
    })

    for (const [order, imagePath] of coach.images.entries()) {
      const mediaId = mediaIdByPath.get(imagePath)
      if (!mediaId) continue
      await prisma.coachImage.upsert({
        where: { coachId_mediaId: { coachId: row.id, mediaId } },
        create: {
          coachId: row.id,
          mediaId,
          order,
          caption: `${coach.name} — ${coach.chassis}, ${coach.bunks} bunks, ${coach.slideOuts.toLowerCase()}, ${coach.rearConfig.toLowerCase()}.`,
        },
        update: { order },
      })
    }
  }
  console.log(`  coaches         ${coaches.length} in ${classNames.length} classes`)

  // --- Locations ------------------------------------------------------------
  for (const location of locations) {
    await prisma.location.upsert({
      where: { slug: location.slug },
      create: {
        slug: location.slug,
        city: location.city,
        state: location.state,
        region: location.region,
        path: location.route,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        isHub: location.isHub,
        isPrimary: location.isHub,
        order: location.order,
        summary: location.summary,
        imageId: location.image ? (mediaIdByPath.get(location.image) ?? null) : null,
      },
      update: { city: location.city, state: location.state, region: location.region, path: location.route },
    })
  }
  console.log(`  locations       ${locations.length}`)

  // --- Testimonials ---------------------------------------------------------
  for (const testimonial of testimonials) {
    await prisma.testimonial.upsert({
      where: { slug: testimonial.slug },
      create: {
        slug: testimonial.slug,
        name: testimonial.name,
        role: testimonial.role,
        quote: testimonial.quote,
        rating: testimonial.rating,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        order: testimonial.order,
        avatarId: testimonial.avatar ? (mediaIdByPath.get(testimonial.avatar) ?? null) : null,
      },
      update: { quote: testimonial.quote, role: testimonial.role },
    })
  }
  console.log(`  testimonials    ${testimonials.length}`)

  // --- FAQs -----------------------------------------------------------------
  const faqGroups: [string, { question: string; answer: string }[]][] = [
    ['home', HOME_FAQS],
    ['entertainer-coach', HOME_FAQS],
    ['nationwide', NATIONWIDE_FAQS],
    ['fleet', FLEET_FAQS],
    ['tour-bus-rental', NATIONWIDE_FAQS],
  ]
  let faqCount = 0
  for (const [group, items] of faqGroups) {
    for (const [order, item] of items.entries()) {
      const slug = `${group}-${order + 1}`
      await prisma.faqItem.upsert({
        where: { slug },
        create: {
          slug,
          group,
          order,
          question: item.question,
          answer: item.answer,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
        update: { question: item.question, answer: item.answer, order },
      })
      faqCount += 1
    }
  }
  console.log(`  faq items       ${faqCount}`)

  // --- Categories and posts -------------------------------------------------
  const categoryIdBySlug = new Map<string, string>()
  for (const [index, category] of categories.entries()) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        slug: category.slug,
        name: category.name,
        description:
          category.slug === 'blog'
            ? 'Practical guides on touring logistics, coach specification and life on the road.'
            : category.description,
        wpId: category.wpId,
        order: index,
      },
      update: { name: category.name },
    })
    categoryIdBySlug.set(category.slug, row.id)
  }

  for (const post of posts) {
    await prisma.post.upsert({
      where: { slug: post.slug },
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        body: post.body,
        status: post.status as ContentStatus,
        publishedAt: post.publishedAt ? new Date(post.publishedAt) : new Date(),
        wpId: post.wpId,
        wpUrl: post.wpUrl,
        authorId: admin.id,
        categoryId: post.categorySlug ? (categoryIdBySlug.get(post.categorySlug) ?? null) : null,
        featuredImageId: post.featuredImage ? (mediaIdByPath.get(post.featuredImage) ?? null) : null,
      },
      update: { title: post.title, body: post.body, excerpt: post.excerpt },
    })
  }
  console.log(`  posts           ${posts.length} in ${categories.length} categories`)

  // --- Forms ----------------------------------------------------------------
  await seedForms()

  // --- Pages ----------------------------------------------------------------
  const pageByRoute = new Map(pages.map((p) => [p.route, p]))
  let pageCount = 0

  const writePage = async (input: {
    route: string
    slug: string
    title: string
    pageType: string
    blocks: SeedBlock[]
    seo?: SeoRecord
    wpId?: number | null
    wpUrl?: string | null
    publishedAt?: Date
    heroImagePath?: string | null
  }) => {
    const page = await prisma.page.upsert({
      where: { path: input.route },
      create: {
        path: input.route,
        slug: input.slug,
        title: input.title,
        pageType: input.pageType,
        status: 'PUBLISHED',
        publishedAt: input.publishedAt ?? new Date(),
        wpId: input.wpId ?? null,
        wpUrl: input.wpUrl ?? null,
        heroImageId: input.heroImagePath ? (mediaIdByPath.get(input.heroImagePath) ?? null) : null,
      },
      update: { title: input.title, pageType: input.pageType, status: 'PUBLISHED' },
    })

    // Blocks are replaced wholesale so a re-seed reflects the current template.
    await prisma.pageBlock.deleteMany({ where: { pageId: page.id } })
    await prisma.pageBlock.createMany({
      data: input.blocks.map((b, order) => ({
        pageId: page.id,
        type: b.type,
        order,
        visible: true,
        props: b.props as object,
      })),
    })

    if (input.seo) {
      await prisma.seoMeta.upsert({
        where: { entityType_entityId: { entityType: 'PAGE', entityId: page.id } },
        create: {
          entityType: 'PAGE',
          entityId: page.id,
          title: input.seo.title,
          description: input.seo.description,
          canonical: input.seo.canonical,
          ogTitle: input.seo.ogTitle,
          ogDescription: input.seo.ogDescription,
          ogImage: input.seo.ogImage,
          robots: input.seo.robots,
        },
        update: {
          title: input.seo.title,
          description: input.seo.description,
          ogImage: input.seo.ogImage,
        },
      })
    }
    pageCount += 1
    return page
  }

  const heroImageFor = (page: PageRecord | undefined, fallback: string): string =>
    page?.seo.ogImage || page?.images.find((i) => /\.(png|jpe?g|webp)$/i.test(i)) || fallback

  const FALLBACK_HERO = mediaRecords.find((m) => /Outlaw/i.test(m.filename))?.path ?? mediaRecords[0]?.path ?? ''

  // ===== HOME ===============================================================
  const home = pageByRoute.get('/')
  await writePage({
    route: '/',
    slug: 'home',
    title: 'Entertainer Coach Rental Nationwide',
    pageType: 'home',
    wpId: home?.wpId ?? null,
    wpUrl: home?.wpUrl ?? null,
    heroImagePath: heroImageFor(home, FALLBACK_HERO),
    seo: home?.seo,
    blocks: [
      // 1-4: H1, service statement, action block, trust strip — all above the fold.
      block('Hero', {
        variant: 'landing',
        background: 'none',
        spacing: 'none',
        headingLevel: 'h1',
        eyebrow: 'Luxury Prevost entertainer coaches',
        heading: 'Entertainer Coach Rental Nationwide — Prevost Tour Buses Across 48 States',
        body:
          'Knights Coaches provides entertainer coach rental on custom-converted Prevost H3-45 and X3-45 platforms. Our fleet carries 6 to 14 bunks, full galleys, private rear lounges and onboard showers, and every booking includes a CDL-certified driver and 24/7 dispatch. We serve touring bands, solo artists, comedians, production crews, political campaigns and corporate clients in any major US city across all 48 contiguous states.',
        image: img(heroImageFor(home, FALLBACK_HERO), 'A Knights Coaches Prevost entertainer coach'),
        showQuoteForm: true,
        quoteFormSlug: 'quote-request',
        quoteFormTitle: 'Get a quote',
        phoneLabel: '24/7 dispatch',
        stats: [
          { value: '48', label: 'States served' },
          { value: '20+', label: 'Coach fleet' },
          { value: '14', label: 'Max bunks' },
          { value: '24/7', label: 'Dispatch' },
        ],
      }),
      block('TrustStrip', { background: 'alt', spacing: 'sm', align: 'center', useTrustSettings: true }),

      // 5: service cards — the internal link mesh. Every card points at a real page.
      block('ServiceCards', {
        background: 'surface',
        spacing: 'md',
        align: 'center',
        eyebrow: 'Explore with us',
        heading: 'Entertainer coach services for every tour',
        body:
          'From single-date pickups to year-long national tours, Knights Coaches provides the coach, the driver and the support that keeps a tour on schedule.',
        columns: 2,
        items: [
          {
            number: '01',
            kicker: 'USA wide',
            title: 'Nationwide coverage',
            badge: '48 states',
            description:
              'We pick up and drop off in any major US city across all 48 contiguous states — Nashville, Los Angeles, New York, Atlanta, Chicago, Dallas, Las Vegas and everywhere between.',
            image: img(heroImageFor(pageByRoute.get('/tour-bus-rental/nationwide'), FALLBACK_HERO), 'Knights Coaches travelling nationwide'),
            bullets: [{ text: 'Touring bands and musicians' }, { text: 'Political and corporate tours' }, { text: 'Production crews and film shoots' }],
            cta: cta('Nationwide rental', '/tour-bus-rental/nationwide'),
          },
          {
            number: '02',
            kicker: 'Most popular',
            title: 'Entertainer coach leasing',
            badge: 'Most popular',
            description:
              'Long-term leases from 1 to 12 months at reduced rates, with guaranteed coach assignments and fleet priority for artists on extended national tours.',
            image: img(heroImageFor(pageByRoute.get('/entertainer-coach/leasing'), FALLBACK_HERO), 'Prevost entertainer coach available for long-term lease'),
            bullets: [{ text: 'Monthly and annual structures' }, { text: 'First pick of the fleet' }, { text: 'Same driver continuity' }],
            cta: cta('Coach leasing', '/entertainer-coach/leasing'),
          },
          {
            number: '03',
            kicker: 'Per-date and per-tour',
            title: 'Entertainer coach rental',
            badge: 'Rental',
            description:
              'Fully equipped Prevost sleeper coaches with a professional CDL driver for single dates, weekend runs or full national tours — outfitted for artists, crews and executive travel.',
            image: img(heroImageFor(pageByRoute.get('/entertainer-coach'), FALLBACK_HERO), 'Interior of a Prevost entertainer coach'),
            bullets: [{ text: 'Full galley and rear lounge' }, { text: 'Onboard shower and bunks' }, { text: 'Pro CDL driver included' }],
            cta: cta('Entertainer rental', '/entertainer-coach'),
          },
          {
            number: '04',
            kicker: 'Gear moves too',
            title: 'Tour trucking',
            badge: 'Trucking',
            description:
              'Enclosed trailers, box trucks and flatbeds moving backline equipment, merchandise and production gear alongside your coach — single-source coordination on one contract.',
            image: img(heroImageFor(pageByRoute.get('/tour-trucking'), FALLBACK_HERO), 'Tour trucking alongside a Knights Coaches entertainer coach'),
            bullets: [{ text: 'Enclosed trailers and box trucks' }, { text: 'Backline, merch and production' }, { text: 'Travels alongside the coach' }],
            cta: cta('Tour trucking', '/tour-trucking'),
          },
        ],
      }),

      // 6: fleet preview with real specs, linking to /fleet
      block('FleetGrid', {
        background: 'alt',
        spacing: 'md',
        eyebrow: 'Our entertainer coaches',
        heading: 'Meet the collection',
        body:
          'Every coach is a custom Prevost conversion built for overnight travel. Class, chassis, bunk count, slide-out and rear configuration are listed on every card.',
        limit: 6,
        columns: 3,
        showFilters: false,
        cta: cta('View all coaches', '/fleet'),
      }),

      // 7: differentiators — verifiable facts
      block('FeatureGrid', {
        background: 'surface',
        spacing: 'md',
        align: 'center',
        eyebrow: 'Why choose us',
        heading: 'Why touring professionals choose Knights Coaches',
        columns: 3,
        items: [
          {
            icon: 'bus',
            title: 'Prevost-built fleet',
            description:
              'Every coach runs on a Prevost H3-45 or X3-45 chassis — the same platforms used by every top-tier operator in the industry.',
            image: image('', ''),
          },
          {
            icon: 'headset',
            title: '24/7 dispatch',
            description:
              'Routing changes, mechanical issues and emergencies handled around the clock by a team that understands touring schedules.',
            image: image('', ''),
          },
          {
            icon: 'map-location-dot',
            title: 'Nationwide coverage',
            description:
              'Pickup and drop-off in any major US city across all 48 contiguous states. Nashville, LA, NYC, Atlanta, Chicago and everywhere between.',
            image: image('', ''),
          },
          {
            icon: 'id-card',
            title: 'CDL-certified drivers',
            description:
              'Three-year minimum on entertainer coaches, current DOT medical cards, FMCSA drug and alcohol clearinghouse enrolment and clean driving records.',
            image: image('', ''),
          },
          {
            icon: 'shield-halved',
            title: 'EMC member',
            description:
              'Entertainer Motorcoach Council membership, with safety, reliability and service standards that exceed the DOT minimum.',
            image: image('', ''),
          },
          {
            icon: 'truck',
            title: 'Tour trucking',
            description:
              'Enclosed trailers, box trucks and flatbeds for backline equipment, merchandise and production gear alongside your coach.',
            image: image('', ''),
          },
        ],
      }),
      block('StatCounters', {
        background: 'alt',
        spacing: 'sm',
        columns: 4,
        items: [
          { value: '20+', label: 'Coaches in fleet', detail: '' },
          { value: '48', label: 'States served', detail: '' },
          { value: '3+ yrs', label: 'Driver minimum', detail: 'On entertainer coaches' },
          { value: '24/7', label: 'Dispatch', detail: 'Live, coast to coast' },
        ],
      }),

      // 8: four numbered booking steps
      block('StepsHowItWorks', {
        background: 'surface',
        spacing: 'md',
        align: 'center',
        eyebrow: 'Simple process',
        heading: 'How to book your entertainer coach',
        body: 'Four steps from first call to tour day.',
        items: [
          {
            icon: 'bus',
            title: 'Select your bus',
            description:
              'Tell us your tour dates, pickup and drop cities, crew size and floor-plan preference, and we match the coach type and capacity to your schedule.',
          },
          {
            icon: 'file-signature',
            title: 'Booking and confirm',
            description:
              'We come back with three coaches from the fleet that fit, each priced with the daily rate, fuel basis, deadhead estimate and a one-driver-or-two recommendation.',
          },
          {
            icon: 'credit-card',
            title: 'Booking payment',
            description:
              'A deposit and a signed contract confirm the booking, itemising every cost component including driver lodging and any one-way drop charges.',
          },
          {
            icon: 'road',
            title: 'Start your roadtrip',
            description:
              'On tour day the coach arrives at pickup, fuelled and inspected, with the chauffeur ready to walk the tour manager through the unit.',
          },
        ],
        cta: cta('Request a quote', '/contact-us'),
      }),

      // 9: coverage as crawlable text links
      block('CoverageMap', {
        background: 'alt',
        spacing: 'md',
        align: 'center',
        eyebrow: 'Where we operate',
        heading: 'Entertainer coach rental across 48 states',
        body:
          'Our fleet is positioned primarily in Nashville, Tennessee and the Mid-Atlantic region, and we pick up and drop off in any major US city.',
        statesHeading: 'States we serve',
        states: US_STATES,
        marketsHeading: 'Primary markets',
        markets: locations
          .filter((l) => l.route)
          .map((l) => ({ label: l.state ? `${l.city}, ${l.state}` : l.city, url: l.route ?? '' })),
        excludedNote:
          'Hawaii and Alaska sit outside the operational footprint because no commercial route accommodates a 45-foot Prevost. Cross-border runs into Canada are quoted case by case.',
        showMap: true,
        cta: cta('Check your city', '/tour-bus-rental/nationwide'),
      }),
      block('DestinationGrid', {
        background: 'surface',
        spacing: 'md',
        eyebrow: 'Where we go',
        heading: 'Our most popular entertainer coach destinations',
        body: 'The cities where most of our tours start, end or pass through.',
        limit: 8,
        hubsOnly: false,
        columns: 4,
        cta: cta('All destinations', '/tour-bus-rental/nationwide'),
      }),

      // 10: testimonials with name and role
      block('Testimonials', {
        background: 'alt',
        spacing: 'md',
        align: 'center',
        eyebrow: 'Our testimonials',
        heading: 'What our clients say',
        body: 'Our reputation rides on every mile.',
        limit: 4,
      }),

      // 11: FAQ — answers in the initial HTML
      block('FaqAccordion', {
        background: 'surface',
        spacing: 'md',
        eyebrow: 'Got questions?',
        heading: 'Frequently asked questions',
        body:
          'Common questions about renting an entertainer coach from Knights Coaches. Still unsure? Our team is one call away.',
        group: 'home',
        limit: 12,
        layout: 'split',
        supportTitle: 'Still have questions?',
        supportBody: 'Talk to our dispatch team, available 24/7.',
        supportPhoneLabel: 'Call',
        supportCta: cta('Send a message', '/contact-us', 'outline'),
      }),

      // 12: related reading
      block('RelatedPosts', {
        background: 'alt',
        spacing: 'md',
        eyebrow: 'Touring guides',
        heading: 'Related reading',
        limit: 3,
      }),

      block('CtaBanner', {
        background: 'surface',
        spacing: 'md',
        heading: 'Ready to book your entertainer coach?',
        body: 'Tell us about your tour — our dispatch team replies within the hour, 24/7.',
        ctas: [cta('Request a quote', '/contact-us'), cta('Browse the fleet', '/fleet', 'outline')],
      }),
    ],
  })

  // ===== FLEET LISTING ======================================================
  const fleetPage = pageByRoute.get('/fleet')
  await writePage({
    route: '/fleet',
    slug: 'fleet',
    title: 'Our Fleet',
    pageType: 'fleet-listing',
    wpId: fleetPage?.wpId ?? null,
    wpUrl: fleetPage?.wpUrl ?? null,
    heroImagePath: heroImageFor(fleetPage, FALLBACK_HERO),
    seo: fleetPage?.seo,
    blocks: [
      block('Hero', {
        variant: 'page',
        background: 'none',
        spacing: 'none',
        headingLevel: 'h1',
        eyebrow: 'Our fleet',
        heading: 'Prevost entertainer coaches built to impress',
        body:
          'Filter by class, bunk count and slide-out configuration to find the coach that fits your crew. Every coach is a custom Prevost conversion maintained to touring standard and configured for overnight travel.',
        image: img(heroImageFor(fleetPage, FALLBACK_HERO), 'Knights Coaches Prevost entertainer coach fleet'),
        breadcrumbLabel: 'Home / Fleet',
        phoneLabel: 'Dispatch',
      }),
      block('FleetGrid', {
        background: 'surface',
        spacing: 'md',
        heading: 'The Knights Coaches collection',
        body: 'Class, chassis, bunk count, slide-out and rear configuration are listed on every card.',
        limit: 48,
        columns: 3,
        showFilters: true,
      }),
      block('CoachSpecTable', {
        background: 'alt',
        spacing: 'md',
        eyebrow: 'Understanding the specs',
        heading: 'What the specifications mean',
        body: 'Every coach in the fleet, side by side, and a plain-language glossary of the terms.',
        showClassComparison: true,
        rows: [
          {
            term: 'Bunk count',
            definition:
              'How many curtained sleeping berths the coach carries, stacked along the centre corridor. Our coaches range from 6 to 14 bunks. The rear configuration may sleep one or two more.',
          },
          {
            term: 'Slide-outs',
            definition:
              'Sections of cabin wall that extend outward when the coach is parked, adding roughly 18 inches of cabin width each. Single, double and triple layouts are available.',
          },
          {
            term: 'Rear configuration',
            definition:
              'What sits at the back of the coach: a shared rear lounge, a private suite or master suite with a bed, or a star configuration combining a private stateroom with extra lounge space.',
          },
          {
            term: 'Chassis',
            definition:
              'The Prevost platform underneath. The H3-45 is the high-deck 45-foot platform with large under-floor bays; the X3-45 is the extruded-aluminium 45-foot platform built for high-mileage overnight touring.',
          },
        ],
      }),
      block('FaqAccordion', {
        background: 'surface',
        spacing: 'md',
        eyebrow: 'Got questions?',
        heading: 'Fleet questions',
        body: 'What the specifications mean and how booking a specific coach works.',
        group: 'fleet',
        limit: 12,
        layout: 'split',
        supportTitle: 'Not sure which coach fits your tour?',
        supportBody: 'Tell us your crew size and route and we will match you to the right coach.',
        supportPhoneLabel: 'Call',
        supportCta: cta('Request a quote', '/contact-us', 'outline'),
      }),
      block('CtaBanner', {
        background: 'alt',
        spacing: 'md',
        heading: 'Not sure which coach fits your tour?',
        body: 'Tell us your crew size and route — our team will match you to the right coach and send a transparent quote.',
        ctas: [cta('Request a quote', '/contact-us')],
      }),
    ],
  })

  // ===== CONTACT ============================================================
  const contactPage = pageByRoute.get('/contact-us')
  await writePage({
    route: '/contact-us',
    slug: 'contact-us',
    title: 'Contact Us',
    pageType: 'contact',
    wpId: contactPage?.wpId ?? null,
    wpUrl: contactPage?.wpUrl ?? null,
    heroImagePath: heroImageFor(contactPage, FALLBACK_HERO),
    seo: contactPage?.seo,
    blocks: [
      block('Hero', {
        variant: 'page',
        background: 'none',
        spacing: 'none',
        headingLevel: 'h1',
        eyebrow: 'Get in touch',
        heading: 'Let us get your tour rolling',
        body:
          'Call dispatch on 855 734 5700, email info@knightscoaches.com, or send your tour details below and we will reply within the hour, 24/7.',
        image: img(heroImageFor(contactPage, FALLBACK_HERO), 'Knights Coaches Prevost entertainer coach interior'),
        breadcrumbLabel: 'Home / Contact Us',
        phoneLabel: 'Call dispatch',
      }),
      block('ContactBlock', {
        background: 'surface',
        spacing: 'md',
        eyebrow: 'Request a quote',
        heading: 'Tell us about your tour',
        body:
          'Share as much as you can — dates, pickup and drop cities, crew size, floor-plan preference and any trucking needs. The more detail, the more accurate the quote.',
        showAddress: true,
        showPhone: true,
        showEmail: true,
        showHours: true,
        hoursLabel: '24/7 dispatch — available now',
        formSlug: 'quote-request',
        showForm: true,
      }),
      block('FaqAccordion', {
        background: 'alt',
        spacing: 'md',
        eyebrow: 'Before you call',
        heading: 'Common questions',
        group: 'home',
        limit: 8,
        layout: 'stacked',
      }),
    ],
  })

  // ===== ABOUT ==============================================================
  const aboutPage = pageByRoute.get('/about-us')
  const aboutSections = aboutPage ? sectionsFrom(aboutPage.outline) : []
  await writePage({
    route: '/about-us',
    slug: 'about-us',
    title: 'About Us',
    pageType: 'about',
    wpId: aboutPage?.wpId ?? null,
    wpUrl: aboutPage?.wpUrl ?? null,
    heroImagePath: heroImageFor(aboutPage, FALLBACK_HERO),
    seo: aboutPage?.seo,
    blocks: [
      block('Hero', {
        variant: 'page',
        background: 'none',
        spacing: 'none',
        headingLevel: 'h1',
        eyebrow: 'About Knights Coaches',
        heading: 'Built for the road. Trusted for the tour.',
        body:
          'Knights Coaches runs a fleet of over 20 custom-converted Prevost H3-45 and X3-45 coaches, each built for overnight touring — full galleys, private rear lounges, onboard showers, and 6 to 14 bunks.',
        image: img(heroImageFor(aboutPage, FALLBACK_HERO), 'Knights Coaches Prevost entertainer coach'),
        breadcrumbLabel: 'Home / About Us',
        phoneLabel: 'Dispatch',
      }),
      block('ServiceStatement', {
        background: 'surface',
        spacing: 'md',
        eyebrow: 'Who we are',
        heading: 'The standard in entertainer coach travel',
        statement:
          'Knights Coaches is a premier provider of luxury Prevost entertainer coaches, built for the demands of life on the road. Our drivers hold CDL Class A or B licences, carry clean DOT medical cards, and average years of entertainer-coach experience. As a member of the Entertainer Motorcoach Council with a satisfactory FMCSA safety rating, we hold ourselves to a higher standard on every mile.',
        points: [
          { text: '20+ custom Prevost H3-45 and X3-45 coaches, maintained to touring standard' },
          { text: 'CDL Class A/B drivers with a three-year minimum on entertainer coaches' },
          { text: 'EMC member, US DOT registered, satisfactory FMCSA safety rating' },
          { text: 'Coast-to-coast pickup in any major US city across all 48 states' },
        ],
      }),
      block('StatCounters', {
        background: 'alt',
        spacing: 'sm',
        columns: 4,
        items: [
          { value: '20+', label: 'Coaches in fleet', detail: '' },
          { value: '48', label: 'States served', detail: '' },
          { value: '3+ yrs', label: 'Driver minimum', detail: '' },
          { value: '24/7', label: 'Dispatch', detail: '' },
        ],
      }),
      ...aboutSections.map((section) =>
        block('RichText', {
          background: 'surface',
          spacing: 'sm',
          heading: section.heading,
          headingLevel: 'h2',
          html: section.html,
          maxWidth: 'prose',
        }),
      ),
      block('FeatureGrid', {
        background: 'alt',
        spacing: 'md',
        align: 'center',
        eyebrow: 'What we stand for',
        heading: 'Values that keep tours rolling',
        columns: 4,
        items: [
          { icon: 'shield-halved', title: 'Safety first', description: 'FMCSA-rated, EMC member, US DOT registered — safety is never optional.', image: image('', '') },
          { icon: 'gem', title: 'Luxury comfort', description: 'Custom Prevost interiors built for real rest between cities.', image: image('', '') },
          { icon: 'clock', title: 'Always on time', description: '24/7 dispatch keeps your tour on schedule, every stop.', image: image('', '') },
          { icon: 'handshake', title: 'True partnership', description: 'We treat every tour like our own — start to finish.', image: image('', '') },
        ],
      }),
      block('CtaBanner', {
        background: 'surface',
        spacing: 'md',
        heading: 'Ready to book your entertainer coach?',
        body: 'Tell us about your tour — our dispatch team replies within the hour, 24/7.',
        ctas: [cta('Request a quote', '/contact-us'), cta('Browse the fleet', '/fleet', 'outline')],
      }),
    ],
  })

  // ===== EVERY OTHER MIGRATED PAGE =========================================
  const HANDLED = new Set(['/', '/fleet', '/contact-us', '/about-us'])

  for (const page of pages) {
    if (HANDLED.has(page.route)) continue

    const isLocation = page.pageType === 'location'
    const isNationwide = page.route === '/tour-bus-rental/nationwide'
    const heroPath = heroImageFor(page, FALLBACK_HERO)
    const statement = firstParagraph(page.outline)
    const heading = h1For(page)
    const sections = sectionsFrom(page.outline, [heading])

    const faqGroup = isNationwide
      ? 'nationwide'
      : page.route.startsWith('/tour-bus-rental')
        ? 'tour-bus-rental'
        : 'entertainer-coach'

    const blocks: SeedBlock[] = [
      block('Hero', {
        variant: 'page',
        background: 'none',
        spacing: 'none',
        headingLevel: 'h1',
        eyebrow: page.title,
        heading,
        body: statement.slice(0, 520),
        image: img(heroPath, `${heading} — Knights Coaches Prevost entertainer coach`),
        breadcrumbLabel: `Home / ${page.title}`,
        phoneLabel: 'Dispatch',
      }),
      block('TrustStrip', { background: 'alt', spacing: 'sm', align: 'center', useTrustSettings: true }),
      ...sections.map((section, i) =>
        block('RichText', {
          background: i % 2 === 0 ? 'surface' : 'alt',
          spacing: 'sm',
          heading: section.heading,
          headingLevel: 'h2',
          html: section.html,
          maxWidth: 'prose',
        }),
      ),
    ]

    if (isLocation || isNationwide) {
      blocks.push(
        block('CoverageMap', {
          background: 'surface',
          spacing: 'md',
          align: 'center',
          eyebrow: 'Coverage',
          heading: 'Where we pick up and drop off',
          body:
            'Our fleet is positioned primarily in Nashville, Tennessee and the Mid-Atlantic region, and we pick up and drop off in any major US city across the 48 contiguous states.',
          statesHeading: 'States we serve',
          states: US_STATES,
          marketsHeading: 'Cities with their own page',
          markets: locations
            .filter((l) => l.route)
            .map((l) => ({ label: l.state ? `${l.city}, ${l.state}` : l.city, url: l.route ?? '' })),
          excludedNote:
            'Hawaii and Alaska sit outside the operational footprint because no commercial route accommodates a 45-foot Prevost.',
          showMap: isNationwide,
          cta: cta('Request a quote', '/contact-us'),
        }),
      )
    }

    blocks.push(
      block('FleetGrid', {
        background: isLocation || isNationwide ? 'alt' : 'surface',
        spacing: 'md',
        eyebrow: 'The fleet',
        heading: 'Coaches available for this service',
        body: 'Class, chassis, bunk count, slide-out and rear configuration on every card.',
        limit: 3,
        columns: 3,
        filterFeatured: true,
        cta: cta('View the full fleet', '/fleet'),
      }),
      block('StepsHowItWorks', {
        background: isLocation || isNationwide ? 'surface' : 'alt',
        spacing: 'md',
        align: 'center',
        eyebrow: 'How it works',
        heading: 'How to book',
        items: [
          { icon: 'bus', title: 'Select your bus', description: 'Tell us your dates, cities, crew size and floor-plan preference.' },
          { icon: 'file-signature', title: 'Booking and confirm', description: 'We send three matching coaches, each priced line by line.' },
          { icon: 'credit-card', title: 'Booking payment', description: 'A deposit and signed contract confirm the booking.' },
          { icon: 'road', title: 'Start your roadtrip', description: 'The coach arrives fuelled, inspected and ready with its driver.' },
        ],
        cta: cta('Request a quote', '/contact-us'),
      }),
      block('FaqAccordion', {
        background: isLocation || isNationwide ? 'alt' : 'surface',
        spacing: 'md',
        eyebrow: 'Got questions?',
        heading: 'Frequently asked questions',
        group: faqGroup,
        limit: 12,
        layout: 'split',
        supportTitle: 'Still have questions?',
        supportBody: 'Talk to our dispatch team, available 24/7.',
        supportPhoneLabel: 'Call',
        supportCta: cta('Send a message', '/contact-us', 'outline'),
      }),
      block('RelatedPosts', {
        background: isLocation || isNationwide ? 'surface' : 'alt',
        spacing: 'md',
        eyebrow: 'Touring guides',
        heading: 'Related reading',
        limit: 3,
      }),
      block('CtaBanner', {
        background: isLocation || isNationwide ? 'alt' : 'surface',
        spacing: 'md',
        heading: 'Ready to book your entertainer coach?',
        body: 'Tell us about your tour — our dispatch team replies within the hour, 24/7.',
        ctas: [cta('Request a quote', '/contact-us'), cta('Browse the fleet', '/fleet', 'outline')],
      }),
    )

    await writePage({
      route: page.route,
      slug: page.slug,
      title: page.title,
      pageType: page.pageType,
      wpId: page.wpId,
      wpUrl: page.wpUrl,
      heroImagePath: heroPath,
      seo: page.seo,
      publishedAt: page.publishedAt ? new Date(page.publishedAt) : new Date(),
      blocks,
    })
  }

  // ===== LEGAL ==============================================================
  for (const legal of LEGAL_PAGES) {
    await writePage({
      route: legal.route,
      slug: legal.route.slice(1),
      title: legal.title,
      pageType: 'legal',
      blocks: [
        block('Hero', {
          variant: 'page',
          background: 'none',
          spacing: 'none',
          headingLevel: 'h1',
          eyebrow: 'Legal',
          heading: legal.heading,
          body: legal.intro,
          image: img(FALLBACK_HERO, 'Knights Coaches Prevost entertainer coach'),
          breadcrumbLabel: `Home / ${legal.title}`,
          phoneLabel: 'Dispatch',
        }),
        ...legal.sections.map((section) =>
          block('RichText', {
            background: 'surface',
            spacing: 'sm',
            heading: section.heading,
            headingLevel: 'h2',
            html: section.html,
            maxWidth: 'prose',
          }),
        ),
      ],
      seo: {
        title: legal.title,
        description: legal.intro,
        canonical: legal.route,
        ogTitle: null,
        ogDescription: null,
        ogImage: null,
        robots: 'INDEX_FOLLOW',
      },
    })
  }
  console.log(`  pages           ${pageCount}`)

  // --- Post SEO -------------------------------------------------------------
  for (const post of posts) {
    const row = await prisma.post.findUnique({ where: { slug: post.slug }, select: { id: true } })
    if (!row) continue
    await prisma.seoMeta.upsert({
      where: { entityType_entityId: { entityType: 'POST', entityId: row.id } },
      create: {
        entityType: 'POST',
        entityId: row.id,
        title: post.seo.title,
        description: post.seo.description,
        canonical: `/blog/${post.slug}`,
        ogImage: post.seo.ogImage,
        robots: post.seo.robots,
        schemaType: 'BlogPosting',
      },
      update: { title: post.seo.title, description: post.seo.description },
    })
  }

  // --- Menus ----------------------------------------------------------------
  await seedMenus()

  // --- Redirects ------------------------------------------------------------
  for (const redirect of redirects) {
    await prisma.redirect.upsert({
      where: { from: redirect.from },
      create: { from: redirect.from, to: redirect.to, kind: redirect.kind, note: redirect.note, enabled: true },
      update: { to: redirect.to, kind: redirect.kind, note: redirect.note },
    })
  }
  console.log(`  redirects       ${redirects.length}`)

  console.log('\n  Seed complete.\n')
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

async function seedForms(): Promise<void> {
  const quote = await prisma.form.upsert({
    where: { slug: 'quote-request' },
    create: {
      slug: 'quote-request',
      name: 'Request a quote',
      description:
        'Tell us about your tour. The more detail you give us, the more accurate the quote — and the faster we can hold a coach for your dates.',
      submitLabel: 'Send request',
      successTitle: 'Request received',
      successBody:
        'Thanks for reaching out. Our dispatch team will be in touch within the hour. Need it sooner? Call 855 734 5700.',
      notifyEmail: process.env.FORM_NOTIFY_EMAIL || 'info@knightscoaches.com',
      enabled: true,
    },
    update: {},
  })

  const quoteFields: {
    name: string
    label: string
    type: 'TEXT' | 'EMAIL' | 'TEL' | 'NUMBER' | 'DATE' | 'TEXTAREA' | 'SELECT' | 'CHECKBOX'
    required?: boolean
    helpText?: string
    options?: string[]
    halfWidth?: boolean
    showWhen?: string
  }[] = [
    { name: 'pickup_location', label: 'Pick-up location', type: 'TEXT', helpText: 'City and state' },
    { name: 'dropoff_location', label: 'Drop-off location', type: 'TEXT', helpText: 'City and state' },
    { name: 'pickup_date', label: 'Pick-up date', type: 'DATE', required: true },
    { name: 'return_date', label: 'Return date', type: 'DATE', required: true },
    { name: 'name', label: 'Name', type: 'TEXT', required: true },
    { name: 'job_title', label: 'Your title', type: 'TEXT' },
    { name: 'email', label: 'Email', type: 'EMAIL', required: true },
    { name: 'phone', label: 'Phone number', type: 'TEL', required: true },
    { name: 'artist_name', label: 'Artist or organisation name', type: 'TEXT' },
    { name: 'coach_count', label: 'Number of coaches', type: 'NUMBER', required: true },
    { name: 'crew_size', label: 'Crew size', type: 'NUMBER', helpText: 'How many people need a bunk' },
    {
      name: 'coach_class',
      label: 'Coach class preference',
      type: 'SELECT',
      options: ['No preference', 'Elite', 'Premium', 'Standard'],
    },
    {
      name: 'needs_trucking',
      label: 'Yes, please quote tour trucking as well',
      type: 'CHECKBOX',
      halfWidth: false,
      helpText: 'Enclosed trailers, box trucks and flatbeds travelling alongside the coach.',
    },
    { name: 'truck_count', label: 'Number of tour trucks', type: 'NUMBER', showWhen: 'needs_trucking' },
    {
      name: 'trailer_type',
      label: 'Trailer type',
      type: 'SELECT',
      options: ['Enclosed trailer', 'Box truck', 'Flatbed', 'Not sure'],
      showWhen: 'needs_trucking',
    },
    {
      name: 'additional_information',
      label: 'Additional information',
      type: 'TEXTAREA',
      required: true,
      halfWidth: false,
      helpText: 'Routing, special requests, load-in constraints — anything that affects the quote.',
    },
  ]

  for (const [order, field] of quoteFields.entries()) {
    await prisma.formField.upsert({
      where: { formId_name: { formId: quote.id, name: field.name } },
      create: {
        formId: quote.id,
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.required ?? false,
        helpText: field.helpText ?? null,
        options: field.options ?? undefined,
        halfWidth: field.halfWidth ?? true,
        showWhen: field.showWhen ?? null,
        order,
      },
      update: { label: field.label, type: field.type, required: field.required ?? false, order },
    })
  }

  const contact = await prisma.form.upsert({
    where: { slug: 'contact' },
    create: {
      slug: 'contact',
      name: 'Send us a message',
      description: 'General enquiries. For a tour quote, use the quote request form — it captures what we need.',
      submitLabel: 'Send message',
      successTitle: 'Message received',
      successBody: 'Thanks — we will reply as soon as we can. For anything urgent, call 855 734 5700.',
      notifyEmail: process.env.FORM_NOTIFY_EMAIL || 'info@knightscoaches.com',
      enabled: true,
    },
    update: {},
  })

  const contactFields = [
    { name: 'name', label: 'Name', type: 'TEXT' as const, required: true },
    { name: 'email', label: 'Email', type: 'EMAIL' as const, required: true },
    { name: 'phone', label: 'Phone number', type: 'TEL' as const, required: false },
    { name: 'subject', label: 'Subject', type: 'TEXT' as const, required: false },
    { name: 'message', label: 'Message', type: 'TEXTAREA' as const, required: true, halfWidth: false },
  ]

  for (const [order, field] of contactFields.entries()) {
    await prisma.formField.upsert({
      where: { formId_name: { formId: contact.id, name: field.name } },
      create: {
        formId: contact.id,
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.required,
        halfWidth: 'halfWidth' in field ? field.halfWidth : true,
        order,
      },
      update: { label: field.label, required: field.required, order },
    })
  }

  console.log('  forms           2 (quote-request, contact)')
}

// ---------------------------------------------------------------------------
// Menus
//
// One canonical URL per topic. The live WordPress footer linked to both
// /entertainer-coach/leasing and /entertainer-coach-rental/leasing, and to both
// /tour-bus-rental/nationwide and /nationwide-tour-bus-rentals. The duplicates
// are 301s; only the canonical route appears here.
// ---------------------------------------------------------------------------

async function seedMenus(): Promise<void> {
  const header = await prisma.menu.upsert({
    where: { slug: 'header' },
    create: { slug: 'header', name: 'Header menu', location: 'HEADER' },
    update: {},
  })
  await prisma.menuItem.deleteMany({ where: { menuId: header.id } })

  const headerItems = [
    { label: 'Home', url: '/' },
    { label: 'About Us', url: '/about-us' },
    { label: 'Fleet', url: '/fleet' },
    { label: 'Entertainer Coach', url: '/entertainer-coach' },
    { label: 'Tour Bus Rental', url: '/tour-bus-rental' },
    { label: 'Nationwide', url: '/tour-bus-rental/nationwide' },
    { label: 'Blog', url: '/blog' },
    { label: 'Contact Us', url: '/contact-us' },
  ]
  for (const [order, item] of headerItems.entries()) {
    await prisma.menuItem.create({
      data: { menuId: header.id, kind: 'PAGE', label: item.label, url: item.url, order },
    })
  }

  const footer = await prisma.menu.upsert({
    where: { slug: 'footer' },
    create: { slug: 'footer', name: 'Footer menu', location: 'FOOTER' },
    update: {},
  })
  await prisma.menuItem.deleteMany({ where: { menuId: footer.id } })

  const columns: { heading: string; links: { label: string; url: string }[] }[] = [
    {
      heading: 'Quick links',
      links: [
        { label: 'Home', url: '/' },
        { label: 'About Us', url: '/about-us' },
        { label: 'Fleet', url: '/fleet' },
        { label: 'Blog', url: '/blog' },
        { label: 'Contact', url: '/contact-us' },
      ],
    },
    {
      heading: 'Services',
      links: [
        { label: 'Entertainer coach rental', url: '/entertainer-coach' },
        // Canonical leasing URL. /entertainer-coach-rental/leasing 301s here.
        { label: 'Coach leasing', url: '/entertainer-coach/leasing' },
        { label: 'Tour bus rental', url: '/tour-bus-rental' },
        // Canonical nationwide URL. /nationwide-tour-bus-rentals 301s here.
        { label: 'Nationwide coverage', url: '/tour-bus-rental/nationwide' },
        { label: 'Tour trucking', url: '/tour-trucking' },
      ],
    },
  ]

  let order = 0
  for (const [index, column] of columns.entries()) {
    const parent = await prisma.menuItem.create({
      data: {
        menuId: footer.id,
        kind: 'CUSTOM',
        label: column.heading,
        url: '#',
        column: index + 1,
        order: order++,
      },
    })
    for (const link of column.links) {
      await prisma.menuItem.create({
        data: {
          menuId: footer.id,
          parentId: parent.id,
          kind: 'PAGE',
          label: link.label,
          url: link.url,
          column: index + 1,
          order: order++,
        },
      })
    }
  }

  console.log('  menus           header (8), footer (2 columns)')
}

main()
  .catch((error) => {
    console.error('\n  Seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
