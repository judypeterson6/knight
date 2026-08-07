/**
 * Page composition for the seed.
 *
 * Pure functions: snapshot in, block list out. No Prisma, no filesystem, no
 * side effects — which is what lets `npm run verify` execute every builder
 * against the real migration snapshot and validate every block it produces
 * before `prisma db seed` ever opens a database connection.
 *
 * There is no placeholder copy in this file. Every string either came out of
 * the WordPress migration or is a factual statement about how this application
 * itself works (the legal pages).
 */

import { blockSchemas, type BlockType } from '../src/lib/blocks/schema'

// ---------------------------------------------------------------------------
// Snapshot types
// ---------------------------------------------------------------------------

export interface OutlineNode {
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'ul' | 'ol'
  text: string
  items?: string[]
}

export interface SeoRecord {
  title: string | null
  description: string | null
  canonical: string | null
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  robots: 'INDEX_FOLLOW' | 'NOINDEX_FOLLOW' | 'INDEX_NOFOLLOW' | 'NOINDEX_NOFOLLOW'
}

export interface PageRecord {
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

export interface MediaRecord {
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

export interface LocationRecord {
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

export interface SeedBlock {
  type: BlockType
  props: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Block helpers
// ---------------------------------------------------------------------------

/**
 * Constructs a block, parsing its props through that block type's own schema.
 * Throws if the props are invalid — which is the point: a bad page template
 * fails loudly at seed time rather than rendering wrong in production.
 */
export function block<T extends BlockType>(type: T, props: Record<string, unknown>): SeedBlock {
  return { type, props: blockSchemas[type].parse(props) as unknown as Record<string, unknown> }
}

export const cta = (label: string, url: string, style: 'primary' | 'outline' | 'ghost' = 'primary') => ({
  label,
  url,
  style,
})

const bareImage = (src: string, alt: string, width = 1024, height = 691, caption = '') => ({
  src,
  alt,
  width,
  height,
  caption,
  decorative: false,
})

/** Resolves a media path to a full image field, using real intrinsic dimensions. */
export interface MediaLookup {
  (path: string | null | undefined, alt: string, caption?: string): ReturnType<typeof bareImage>
}

export function mediaLookup(media: MediaRecord[]): MediaLookup {
  const byPath = new Map(media.map((m) => [m.path, m]))
  return (path, alt, caption = '') => {
    if (!path) return bareImage('', alt)
    const meta = byPath.get(path)
    return bareImage(path, meta?.alt || alt, meta?.width ?? 1024, meta?.height ?? 691, caption)
  }
}

// ---------------------------------------------------------------------------
// Migrated-content transforms
// ---------------------------------------------------------------------------

/** Drops WordPress breadcrumbs and other chrome that is not body copy. */
export function isBodyNode(node: OutlineNode): boolean {
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

export function escapeHtml(value: string): string {
  return value.replace(/&(?!(?:amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Turns a migrated page's outline into sections — one per h1/h2 boundary,
 * preserving heading level, list structure and section order.
 */
/**
 * Headings in the outline that resolve to a feature grid rather than prose.
 * Used to keep the same section from rendering twice.
 */
export function featureSections(outline: OutlineNode[]): FeatureSection[] {
  const nodes = outline.filter(isBodyNode)
  const found: FeatureSection[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    if (nodes[i].tag !== 'h2' && nodes[i].tag !== 'h1') continue
    const section = featureSectionAt(outline, i)
    if (section) found.push(section)
  }
  return found
}

export function sectionsFrom(outline: OutlineNode[], skipHeadings: string[] = []): { heading: string; html: string }[] {
  const nodes = outline.filter(isBodyNode)
  const sections: { heading: string; html: string }[] = []
  let current: { heading: string; parts: string[] } | null = null
  const skip = new Set(skipHeadings.map((s) => s.toLowerCase().trim()))

  const flush = (): void => {
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

/**
 * Migrated headings that a purpose-built block already renders further down the
 * page. Keeping them as RichText too produced the section twice — once as a
 * proper component, once as raw text with an image bolted on.
 *
 * The narrative "How to book an entertainer coach" paragraph is deliberately NOT
 * matched: the source carries both a prose explanation and a card grid, and only
 * the card grid is replaced by StepsHowItWorks.
 */
const DUPLICATED_BY_A_BLOCK: RegExp[] = [
  /^how to book your\b/i, // card grid -> StepsHowItWorks
  /^how to book a\b.*\brental$/i, // ditto, nationwide wording
  /^how to (hire|reserve|rent)\b/i, // city-page wording for the same 4 steps
  /^booking your\b/i, // audience-page wording for the same 4 steps
  /^frequently asked questions/i, // -> FaqAccordion
  /^our most popular$/i, // split heading -> DestinationGrid
  /destinations$/i, // -> DestinationGrid
  /^our prevost coach fleet/i, // -> FleetGrid
  /coverage across \d+ states$/i, // -> CoverageMap
  /^(send us (a )?message|get in touch|contact us)$/i, // contact chrome, not body copy
]

export function isDuplicatedByBlock(heading: string): boolean {
  const h = heading.trim()
  return DUPLICATED_BY_A_BLOCK.some((re) => re.test(h))
}

/**
 * Trims a migrated opening paragraph to its first couple of sentences.
 *
 * The WordPress intros run 400-600 characters. Beside a quote form in the hero
 * that pushes the fields off-screen, and the ranking spec asks for 2-3 factual
 * sentences here, not a wall.
 */
export function leadSentences(text: string, max = 2): string {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g)
  if (!sentences?.length) return text.slice(0, 240).trim()
  return sentences.slice(0, max).join('').trim()
}

/**
 * Sections whose body is a run of short h3 items — "What's included in every
 * rental", "Why touring professionals choose us" — are feature lists, not
 * prose. Rendered as RichText they became a wall of tiny sub-headings; as a
 * FeatureGrid they get an icon card each, which is what the design does.
 */
export interface FeatureSection {
  heading: string
  intro: string
  items: { icon: string; title: string; description: string }[]
}

/** Keyword -> icon, so each card gets something better than a generic tick. */
const ICON_HINTS: [RegExp, string][] = [
  [/driver|cdl|chauffeur/i, 'id-card'],
  [/dispatch|support|24\/7|routing/i, 'headset'],
  [/fleet|prevost|coach|chassis|bus/i, 'bus'],
  [/truck|trailer|backline|gear|merch/i, 'truck'],
  [/emc|dot|fmcsa|safety|certif|complian/i, 'shield-halved'],
  [/state|coverage|nationwide|city|pickup|market/i, 'map-location-dot'],
  [/bunk|sleep|bed/i, 'bed'],
  [/galley|kitchen|food/i, 'utensils'],
  [/shower|bathroom/i, 'shower'],
  [/lounge|seat|sofa/i, 'couch'],
  [/wifi|power|outlet|connect/i, 'plug'],
  [/tv|entertain|sound/i, 'tv'],
  [/climate|heat|air/i, 'temperature-half'],
  [/price|cost|rate|payment|fee/i, 'credit-card'],
  [/book|reserv|schedul|lease|term|continuity/i, 'calendar-check'],
  [/inspect|maintain|service|mechanic/i, 'screwdriver-wrench'],
  [/time|hour|clock/i, 'clock'],
]

export function iconFor(text: string): string {
  for (const [pattern, icon] of ICON_HINTS) if (pattern.test(text)) return icon
  return 'circle-check'
}

/**
 * Pulls a feature list out of a page outline: an h2 followed by three or more
 * h3s, each with a short paragraph. Returns null when the section is ordinary
 * prose, which then renders as RichText as before.
 */
export function featureSectionAt(outline: OutlineNode[], startIndex: number): FeatureSection | null {
  const nodes = outline.filter(isBodyNode)
  const head = nodes[startIndex]
  if (!head || (head.tag !== 'h2' && head.tag !== 'h1')) return null

  const items: { icon: string; title: string; description: string }[] = []
  let intro = ''
  let pendingIntroHeading = false

  for (let i = startIndex + 1; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (node.tag === 'h1' || node.tag === 'h2') break

    if (node.tag === 'h3') {
      // A sub-heading phrased as a question ("Why touring professionals choose
      // us") introduces the group; it is not one of the cards. Its copy folds
      // into the section intro instead of becoming a card nobody can parse.
      if (/^(why|how|what|when|where|who)\b/i.test(node.text.trim())) {
        pendingIntroHeading = true
        continue
      }
      items.push({ icon: iconFor(node.text), title: node.text, description: '' })
      continue
    }
    if (node.tag === 'p') {
      if (pendingIntroHeading) {
        intro = intro ? `${intro} ${node.text}` : node.text
        pendingIntroHeading = false
      } else if (items.length) {
        const last = items[items.length - 1]
        last.description = last.description ? `${last.description} ${node.text}` : node.text
      } else if (!intro) {
        intro = node.text
      }
    }
  }

  // Three or more titled items with copy is a grid; anything less is prose.
  const usable = items.filter((i) => i.title.trim() && i.description.trim())
  if (usable.length < 3) return null

  return { heading: head.text, intro, items: usable }
}

export function firstParagraph(outline: OutlineNode[]): string {
  return outline.find((n) => n.tag === 'p' && isBodyNode(n))?.text ?? ''
}

/** The source pages carry several h1s (Elementor). Ours has exactly one. */
export function h1For(page: PageRecord): string {
  const fromOutline = page.outline.find((n) => (n.tag === 'h1' || n.tag === 'h2') && isBodyNode(n))?.text
  return (fromOutline ?? page.title).trim()
}

export function heroImageFor(page: PageRecord | undefined, fallback: string): string {
  return page?.seo.ogImage || page?.images.find((i) => /\.(png|jpe?g|webp)$/i.test(i)) || fallback
}

// ---------------------------------------------------------------------------
// Reference content
// ---------------------------------------------------------------------------

export const US_STATES: { code: string; name: string }[] = [
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

export const HOME_FAQS: { question: string; answer: string }[] = [
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

export const NATIONWIDE_FAQS: { question: string; answer: string }[] = [
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

export const FLEET_FAQS: { question: string; answer: string }[] = [
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

export interface LegalPage {
  route: string
  title: string
  heading: string
  intro: string
  sections: { heading: string; html: string }[]
}

/**
 * The source WordPress site publishes no legal pages, so these describe what
 * this application actually does — the data it stores, where, and who else can
 * see it. They are accurate as built; counsel should review before launch.
 */
export const LEGAL_PAGES: LegalPage[] = [
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
    intro: 'What the information on this site does and does not promise.',
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
// Builder context
// ---------------------------------------------------------------------------

export interface BuildContext {
  pageByRoute: Map<string, PageRecord>
  locations: LocationRecord[]
  img: MediaLookup
  fallbackHero: string
  mediaByPath: Map<string, MediaRecord>
  /** Site-wide inclusions, used on pages that carry no feature list of their own. */
  sharedFeatures: FeatureSection | null
}

/**
 * Finds the "What's Included in Every Rental" section in the migrated corpus.
 *
 * Its own copy states the inclusions apply "regardless of class or lease
 * length", so it is a fact about the operator rather than about one page. Only
 * 4 of 44 migrated pages carry a feature list; the rest have nothing but the
 * how-to-book steps, which already render as StepsHowItWorks. Reusing this one
 * real section on those pages keeps every page consistent without inventing
 * claims — and each copy seeds as an ordinary block, so it stays editable
 * per page from /admin.
 */
export function sharedFeatureSection(pages: PageRecord[]): FeatureSection | null {
  for (const page of pages) {
    for (const section of featureSections(page.outline)) {
      if (/included in every rental/i.test(section.heading)) return section
    }
  }
  return null
}

export function buildContext(pages: PageRecord[], locations: LocationRecord[], media: MediaRecord[]): BuildContext {
  return {
    pageByRoute: new Map(pages.map((p) => [p.route, p])),
    locations,
    img: mediaLookup(media),
    fallbackHero: media.find((m) => /Outlaw/i.test(m.filename))?.path ?? media[0]?.path ?? '',
    mediaByPath: new Map(media.map((m) => [m.path, m])),
    sharedFeatures: sharedFeatureSection(pages),
  }
}

/**
 * Images from a migrated page that are worth pairing with a text section.
 *
 * Filters out the things WordPress leaves lying around in page markup — avatars,
 * logos, icons, client badges and anything too small to hold a half-width
 * column. `exclude` drops the hero, which the page already uses at the top.
 */
export function sectionImagePool(page: PageRecord, ctx: BuildContext, exclude: string): string[] {
  const seen = new Set<string>([exclude])
  const pool: string[] = []

  for (const path of page.images) {
    if (seen.has(path)) continue
    seen.add(path)

    if (!/\.(png|jpe?g|webp)$/i.test(path)) continue
    if (/(logo|icon|avatar|badge|favicon|client|logoipsum|placeholder)/i.test(path)) continue
    if (/-\d{2,3}x\d{2,3}\./.test(path)) continue // WordPress thumbnail sizes

    const meta = ctx.mediaByPath.get(path)
    if (meta && meta.width !== null && meta.width < 600) continue

    pool.push(path)
  }
  return pool
}

const marketLinks = (locations: LocationRecord[]) =>
  locations
    .filter((l) => l.route)
    .map((l) => ({ label: l.state ? `${l.city}, ${l.state}` : l.city, url: l.route ?? '' }))

// ---------------------------------------------------------------------------
// Page builders
// ---------------------------------------------------------------------------

/**
 * Homepage.
 *
 * Block order follows the ranking spec exactly: H1 + service statement + the
 * action block (an inline quote form, not a scroll link) + trust strip above
 * the fold; then service cards, fleet preview, differentiators, how-to-book,
 * coverage, testimonials, FAQ and related reading below it.
 */
export function buildHomeBlocks(ctx: BuildContext): SeedBlock[] {
  const home = ctx.pageByRoute.get('/')
  const hero = heroImageFor(home, ctx.fallbackHero)

  return [
    block('Hero', {
      variant: 'landing',
      background: 'none',
      spacing: 'none',
      headingLevel: 'h1',
      eyebrow: 'Luxury Prevost entertainer coaches',
      heading: 'Entertainer Coach Rental Nationwide — Prevost Tour Buses Across 48 States',
      body:
        'Knights Coaches provides entertainer coach rental on custom-converted Prevost H3-45 and X3-45 platforms. Our fleet carries 6 to 14 bunks, full galleys, private rear lounges and onboard showers, and every booking includes a CDL-certified driver and 24/7 dispatch. We serve touring bands, solo artists, comedians, production crews, political campaigns and corporate clients in any major US city across all 48 contiguous states.',
      image: ctx.img(hero, 'A Knights Coaches Prevost entertainer coach'),
      showQuoteForm: true,
      quoteFormSlug: 'quote-request',
      quoteFormTitle: 'Get a quote',
      phoneLabel: '24/7 dispatch',
      ctas: [cta('Explore the fleet', '/fleet', 'ghost')],
      stats: [
        { value: '48', label: 'States served' },
        { value: '20+', label: 'Coach fleet' },
        { value: '14', label: 'Max bunks' },
        { value: '24/7', label: 'Dispatch' },
      ],
    }),

    block('TrustStrip', { background: 'alt', spacing: 'sm', align: 'center', useTrustSettings: true }),

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
          image: ctx.img(
            heroImageFor(ctx.pageByRoute.get('/tour-bus-rental/nationwide'), ctx.fallbackHero),
            'Knights Coaches travelling nationwide',
          ),
          bullets: [
            { text: 'Touring bands and musicians' },
            { text: 'Political and corporate tours' },
            { text: 'Production crews and film shoots' },
          ],
          cta: cta('Nationwide rental', '/tour-bus-rental/nationwide'),
        },
        {
          number: '02',
          kicker: 'Most popular',
          title: 'Entertainer coach leasing',
          badge: 'Most popular',
          description:
            'Long-term leases from 1 to 12 months at reduced rates, with guaranteed coach assignments and fleet priority for artists on extended national tours.',
          image: ctx.img(
            heroImageFor(ctx.pageByRoute.get('/entertainer-coach/leasing'), ctx.fallbackHero),
            'Prevost entertainer coach available for long-term lease',
          ),
          bullets: [
            { text: 'Monthly and annual structures' },
            { text: 'First pick of the fleet' },
            { text: 'Same driver continuity' },
          ],
          cta: cta('Coach leasing', '/entertainer-coach/leasing'),
        },
        {
          number: '03',
          kicker: 'Per-date and per-tour',
          title: 'Entertainer coach rental',
          badge: 'Rental',
          description:
            'Fully equipped Prevost sleeper coaches with a professional CDL driver for single dates, weekend runs or full national tours — outfitted for artists, crews and executive travel.',
          image: ctx.img(
            heroImageFor(ctx.pageByRoute.get('/entertainer-coach'), ctx.fallbackHero),
            'Interior of a Prevost entertainer coach',
          ),
          bullets: [
            { text: 'Full galley and rear lounge' },
            { text: 'Onboard shower and bunks' },
            { text: 'Pro CDL driver included' },
          ],
          cta: cta('Entertainer rental', '/entertainer-coach'),
        },
        {
          number: '04',
          kicker: 'Gear moves too',
          title: 'Tour trucking',
          badge: 'Trucking',
          description:
            'Enclosed trailers, box trucks and flatbeds moving backline equipment, merchandise and production gear alongside your coach — single-source coordination on one contract.',
          image: ctx.img(
            heroImageFor(ctx.pageByRoute.get('/tour-trucking'), ctx.fallbackHero),
            'Tour trucking alongside a Knights Coaches entertainer coach',
          ),
          bullets: [
            { text: 'Enclosed trailers and box trucks' },
            { text: 'Backline, merch and production' },
            { text: 'Travels alongside the coach' },
          ],
          cta: cta('Tour trucking', '/tour-trucking'),
        },
      ],
    }),

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
        },
        {
          icon: 'headset',
          title: '24/7 dispatch',
          description:
            'Routing changes, mechanical issues and emergencies handled around the clock by a team that understands touring schedules.',
        },
        {
          icon: 'map-location-dot',
          title: 'Nationwide coverage',
          description:
            'Pickup and drop-off in any major US city across all 48 contiguous states. Nashville, LA, NYC, Atlanta, Chicago and everywhere between.',
        },
        {
          icon: 'id-card',
          title: 'CDL-certified drivers',
          description:
            'Three-year minimum on entertainer coaches, current DOT medical cards, FMCSA drug and alcohol clearinghouse enrolment and clean driving records.',
        },
        {
          icon: 'shield-halved',
          title: 'EMC member',
          description:
            'Entertainer Motorcoach Council membership, with safety, reliability and service standards that exceed the DOT minimum.',
        },
        {
          icon: 'truck',
          title: 'Tour trucking',
          description:
            'Enclosed trailers, box trucks and flatbeds for backline equipment, merchandise and production gear alongside your coach.',
        },
      ],
    }),

    block('StatCounters', {
      background: 'alt',
      spacing: 'sm',
      columns: 4,
      items: [
        { value: '20+', label: 'Coaches in fleet' },
        { value: '48', label: 'States served' },
        { value: '3+ yrs', label: 'Driver minimum', detail: 'On entertainer coaches' },
        { value: '24/7', label: 'Dispatch', detail: 'Live, coast to coast' },
      ],
    }),

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
      markets: marketLinks(ctx.locations),
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

    block('Testimonials', {
      background: 'alt',
      spacing: 'md',
      align: 'center',
      eyebrow: 'Our testimonials',
      heading: 'What our clients say',
      body: 'Our reputation rides on every mile.',
      limit: 4,
    }),

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
  ]
}

/** Fleet listing: H1 + selection criteria, working filters, grid, comparison, glossary, FAQ. */
export function buildFleetBlocks(ctx: BuildContext): SeedBlock[] {
  const page = ctx.pageByRoute.get('/fleet')
  const hero = heroImageFor(page, ctx.fallbackHero)

  return [
    block('Hero', {
      variant: 'page',
      background: 'none',
      spacing: 'none',
      headingLevel: 'h1',
      eyebrow: 'Our fleet',
      heading: 'Prevost entertainer coaches built to impress',
      body:
        'Filter by class, bunk count and slide-out configuration to find the coach that fits your crew. Every coach is a custom Prevost conversion maintained to touring standard and configured for overnight travel.',
      image: ctx.img(hero, 'Knights Coaches Prevost entertainer coach fleet'),
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
  ]
}

/** Contact page: form, address, phone, email, hours. */
export function buildContactBlocks(ctx: BuildContext): SeedBlock[] {
  const page = ctx.pageByRoute.get('/contact-us')
  const hero = heroImageFor(page, ctx.fallbackHero)

  return [
    block('Hero', {
      variant: 'page',
      background: 'none',
      spacing: 'none',
      headingLevel: 'h1',
      eyebrow: 'Get in touch',
      heading: 'Let us get your tour rolling',
      body:
        'Call dispatch on 855 734 5700, email info@knightscoaches.com, or send your tour details below and we will reply within the hour, 24/7.',
      image: ctx.img(hero, 'Knights Coaches Prevost entertainer coach interior'),
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
  ]
}

/** About page: migrated body sections wrapped in the designed stack. */
export function buildAboutBlocks(ctx: BuildContext): SeedBlock[] {
  const page = ctx.pageByRoute.get('/about-us')
  const hero = heroImageFor(page, ctx.fallbackHero)
  const sections = page ? sectionsFrom(page.outline).filter((s) => !isDuplicatedByBlock(s.heading)) : []
  const aboutPool = page ? sectionImagePool(page, ctx, hero) : []

  return [
    block('Hero', {
      variant: 'page',
      background: 'none',
      spacing: 'none',
      headingLevel: 'h1',
      eyebrow: 'About Knights Coaches',
      heading: 'Built for the road. Trusted for the tour.',
      body:
        'Knights Coaches runs a fleet of over 20 custom-converted Prevost H3-45 and X3-45 coaches, each built for overnight touring — full galleys, private rear lounges, onboard showers, and 6 to 14 bunks.',
      image: ctx.img(hero, 'Knights Coaches Prevost entertainer coach'),
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
        { value: '20+', label: 'Coaches in fleet' },
        { value: '48', label: 'States served' },
        { value: '3+ yrs', label: 'Driver minimum' },
        { value: '24/7', label: 'Dispatch' },
      ],
    }),
    ...sections.map((section, i) => {
      const imagePath = aboutPool[i]
      const hasImage = Boolean(imagePath)
      return block('RichText', {
        background: i % 2 === 0 ? 'surface' : 'alt',
        spacing: 'md',
        heading: section.heading,
        headingLevel: 'h2',
        html: section.html,
        maxWidth: hasImage ? 'full' : 'prose',
        imagePosition: hasImage ? (i % 2 === 0 ? 'right' : 'left') : 'none',
        image: hasImage ? ctx.img(imagePath, `${section.heading || 'Knights Coaches'}`) : ctx.img(null, ''),
      })
    }),
    block('FeatureGrid', {
      background: 'alt',
      spacing: 'md',
      align: 'center',
      eyebrow: 'What we stand for',
      heading: 'Values that keep tours rolling',
      columns: 4,
      items: [
        { icon: 'shield-halved', title: 'Safety first', description: 'FMCSA-rated, EMC member, US DOT registered — safety is never optional.' },
        { icon: 'gem', title: 'Luxury comfort', description: 'Custom Prevost interiors built for real rest between cities.' },
        { icon: 'clock', title: 'Always on time', description: '24/7 dispatch keeps your tour on schedule, every stop.' },
        { icon: 'handshake', title: 'True partnership', description: 'We treat every tour like our own — start to finish.' },
      ],
    }),
    block('CtaBanner', {
      background: 'surface',
      spacing: 'md',
      heading: 'Ready to book your entertainer coach?',
      body: 'Tell us about your tour — our dispatch team replies within the hour, 24/7.',
      ctas: [cta('Request a quote', '/contact-us'), cta('Browse the fleet', '/fleet', 'outline')],
    }),
  ]
}

/**
 * Every other migrated page — the 12 audience pages, the 20 city pages,
 * /tour-bus-rental, /entertainer-coach, /tour-trucking and the rest.
 *
 * The migrated body becomes one RichText block per h2 section, preserving
 * heading level, list structure and order, wrapped in the service or location
 * layout depending on the page type.
 */
export function buildGenericBlocks(page: PageRecord, ctx: BuildContext): SeedBlock[] {
  const isLocation = page.pageType === 'location'
  const isNationwide = page.route === '/tour-bus-rental/nationwide'
  const geo = isLocation || isNationwide

  const hero = heroImageFor(page, ctx.fallbackHero)
  const statement = firstParagraph(page.outline)
  const heading = h1For(page)
  // Sections that are really feature lists become icon grids, so they are
  // excluded from the prose sections to avoid rendering the same content twice.
  const ownFeatures = featureSections(page.outline).filter((f) => !isDuplicatedByBlock(f.heading))
  // A page with no feature list of its own still gets one, from the site-wide
  // inclusions — see sharedFeatureSection. Pages that have their own keep it.
  const features = ownFeatures.length || !ctx.sharedFeatures ? ownFeatures : [ctx.sharedFeatures]
  const featureHeadings = new Set(features.map((f) => f.heading.toLowerCase().trim()))

  // Drop the migrated headings that StepsHowItWorks, FaqAccordion,
  // DestinationGrid, FleetGrid and CoverageMap render properly below.
  const sections = sectionsFrom(page.outline, [heading]).filter(
    (s) => !isDuplicatedByBlock(s.heading) && !featureHeadings.has(s.heading.toLowerCase().trim()),
  )
  const pool = sectionImagePool(page, ctx, hero)

  const faqGroup = isNationwide
    ? 'nationwide'
    : page.route.startsWith('/tour-bus-rental')
      ? 'tour-bus-rental'
      : 'entertainer-coach'

  const blocks: SeedBlock[] = [
    /**
     * Service and location pages carry the quote form in the hero, so the
     * action block sits in the viewport beside the H1 rather than after a
     * scroll. The statement is cut to its opening sentences for the same
     * reason — the full migrated intro pushed the fields off-screen.
     */
    block('Hero', {
      variant: 'landing',
      background: 'none',
      spacing: 'none',
      headingLevel: 'h1',
      eyebrow: page.title,
      heading,
      body: leadSentences(statement),
      image: ctx.img(hero, `${heading} — Knights Coaches Prevost entertainer coach`),
      breadcrumbLabel: `Home / ${page.title}`,
      phoneLabel: '24/7 dispatch',
      // A secondary route out of the hero, so the action row is a considered
      // pair rather than one stranded button.
      ctas: [cta('Explore the fleet', '/fleet', 'ghost')],
      showQuoteForm: true,
      quoteFormSlug: 'quote-request',
      quoteFormTitle: 'Get a quote',
    }),
    block('TrustStrip', { background: 'alt', spacing: 'sm', align: 'center', useTrustSettings: true }),

    /**
     * Body sections alternate image-right / image-left, the way the design
     * source lays out its two-column bands, instead of stacking as plain text.
     * Images come from the page's own migrated assets; once the pool runs out
     * the remaining sections fall back to a centred prose column rather than
     * repeating the same photograph down the page.
     */
    ...sections.map((section, i) => {
      const imagePath = pool[i]
      const hasImage = Boolean(imagePath)

      return block('RichText', {
        background: i % 2 === 0 ? 'surface' : 'alt',
        spacing: 'md',
        heading: section.heading,
        headingLevel: 'h2',
        html: section.html,
        maxWidth: hasImage ? 'full' : 'prose',
        imagePosition: hasImage ? (i % 2 === 0 ? 'right' : 'left') : 'none',
        image: hasImage
          ? ctx.img(imagePath, `${section.heading || heading} — Knights Coaches`)
          : ctx.img(null, ''),
      })
    }),
  ]

  // Feature lists as icon grids, after the prose sections.
  for (const [i, section] of features.entries()) {
    blocks.push(
      block('FeatureGrid', {
        background: (sections.length + i) % 2 === 0 ? 'surface' : 'alt',
        spacing: 'md',
        align: 'center',
        heading: section.heading,
        headingLevel: 'h2',
        body: section.intro,
        columns: section.items.length % 4 === 0 ? 4 : 3,
        items: section.items,
      }),
    )
  }

  if (geo) {
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
        markets: marketLinks(ctx.locations),
        excludedNote:
          'Hawaii and Alaska sit outside the operational footprint because no commercial route accommodates a 45-foot Prevost.',
        showMap: isNationwide,
        cta: cta('Request a quote', '/contact-us'),
      }),
    )
  }

  blocks.push(
    block('FleetGrid', {
      background: geo ? 'alt' : 'surface',
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
      background: geo ? 'surface' : 'alt',
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
      background: geo ? 'alt' : 'surface',
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
      background: geo ? 'surface' : 'alt',
      spacing: 'md',
      eyebrow: 'Touring guides',
      heading: 'Related reading',
      limit: 3,
    }),
    block('CtaBanner', {
      background: geo ? 'alt' : 'surface',
      spacing: 'md',
      heading: 'Ready to book your entertainer coach?',
      body: 'Tell us about your tour — our dispatch team replies within the hour, 24/7.',
      ctas: [cta('Request a quote', '/contact-us'), cta('Browse the fleet', '/fleet', 'outline')],
    }),
  )

  return blocks
}

export function buildLegalBlocks(legal: LegalPage, ctx: BuildContext): SeedBlock[] {
  return [
    block('Hero', {
      variant: 'page',
      background: 'none',
      spacing: 'none',
      headingLevel: 'h1',
      eyebrow: 'Legal',
      heading: legal.heading,
      body: legal.intro,
      image: ctx.img(ctx.fallbackHero, 'Knights Coaches Prevost entertainer coach'),
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
  ]
}

/** Pages the seed composes with a bespoke stack rather than the generic one. */
export const BESPOKE_ROUTES = new Set(['/', '/fleet', '/contact-us', '/about-us'])
