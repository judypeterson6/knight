import { z } from 'zod'

/**
 * The fixed block library.
 *
 * Every visible string on the front end is a field in one of these schemas and
 * is therefore stored in MySQL and editable from /admin. There is no free-form
 * canvas: a page is an ordered list of these twenty typed blocks.
 */

export const BLOCK_TYPES = [
  'Hero',
  'RichText',
  'ServiceStatement',
  'QuoteForm',
  'TrustStrip',
  'ServiceCards',
  'FleetGrid',
  'CoachSpecTable',
  'StatCounters',
  'FeatureGrid',
  'StepsHowItWorks',
  'CoverageMap',
  'DestinationGrid',
  'Testimonials',
  'FaqAccordion',
  'CtaBanner',
  'Gallery',
  'RelatedPosts',
  'ContactBlock',
  'RawHtml',
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

/** Spacing / background / alignment tokens available on every block. */
export const baseProps = z.object({
  background: z.enum(['surface', 'alt', 'dark', 'primary', 'none']).default('surface'),
  spacing: z.enum(['none', 'sm', 'md', 'lg']).default('md'),
  align: z.enum(['left', 'center']).default('left'),
  /** Renders as the section's id so menus can deep-link to it. */
  anchor: z.string().default(''),
  /** Optional per-block CSS class hook for the custom-CSS box. */
  className: z.string().default(''),
})

const image = z.object({
  src: z.string().default(''),
  /** Required whenever src is set — enforced by requireAlt() below. */
  alt: z.string().default(''),
  width: z.number().int().positive().default(1024),
  height: z.number().int().positive().default(691),
  caption: z.string().default(''),
  decorative: z.boolean().default(false),
})

const cta = z.object({
  label: z.string().default(''),
  url: z.string().default(''),
  style: z.enum(['primary', 'outline', 'ghost']).default('primary'),
})

/**
 * Field-position variants.
 *
 * Every inner property already has a default, so `.default({})` makes the whole
 * object optional in stored props. Without this, parsing an empty props object —
 * which is exactly what happens when an editor inserts a fresh block — throws.
 */
const imageField = image.default({})
const ctaField = cta.default({})

const heading = {
  eyebrow: z.string().default(''),
  heading: z.string().default(''),
  headingLevel: z.enum(['h1', 'h2', 'h3']).default('h2'),
  subheading: z.string().default(''),
  body: z.string().default(''),
}

export const imageSchema = image
export const ctaSchema = cta

// ---------------------------------------------------------------------------
// Per-block props
// ---------------------------------------------------------------------------

const hero = baseProps.extend({
  ...heading,
  headingLevel: z.enum(['h1', 'h2']).default('h1'),
  /** 'landing' renders the action block in-viewport; 'page' is the inner-page banner. */
  variant: z.enum(['landing', 'page']).default('page'),
  image: imageField,
  videoSrc: z.string().default(''),
  breadcrumbLabel: z.string().default(''),
  ctas: z.array(cta).default([]),
  /** Renders the inline quote form inside the hero, above the fold. */
  showQuoteForm: z.boolean().default(false),
  quoteFormSlug: z.string().default('quote-request'),
  quoteFormTitle: z.string().default(''),
  phoneLabel: z.string().default(''),
  stats: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .default([]),
})

const richText = baseProps.extend({
  ...heading,
  /** Sanitised HTML from Tiptap or the WordPress migration. */
  html: z.string().default(''),
  image: imageField,
  imagePosition: z.enum(['none', 'left', 'right']).default('none'),
  ctas: z.array(cta).default([]),
  maxWidth: z.enum(['prose', 'full']).default('full'),
})

const serviceStatement = baseProps.extend({
  ...heading,
  /** 2–3 factual sentences: what is provided, on what equipment, over what area. */
  statement: z.string().default(''),
  points: z.array(z.object({ text: z.string() })).default([]),
})

const quoteForm = baseProps.extend({
  ...heading,
  formSlug: z.string().default('quote-request'),
  phoneLabel: z.string().default('Or call'),
  showPhone: z.boolean().default(true),
  compact: z.boolean().default(false),
})

const trustStrip = baseProps.extend({
  heading: z.string().default(''),
  /** Text labels, never badge images alone. */
  items: z.array(z.object({ label: z.string(), detail: z.string(), url: z.string() })).default([]),
  useTrustSettings: z.boolean().default(true),
})

const serviceCards = baseProps.extend({
  ...heading,
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
  items: z
    .array(
      z.object({
        number: z.string().default(''),
        kicker: z.string().default(''),
        title: z.string(),
        description: z.string(),
        badge: z.string().default(''),
        image: imageField,
        bullets: z.array(z.object({ text: z.string() })).default([]),
        cta: ctaField,
      }),
    )
    .default([]),
})

const fleetGrid = baseProps.extend({
  ...heading,
  /** Empty = all classes. */
  filterClass: z.string().default(''),
  filterFeatured: z.boolean().default(false),
  limit: z.number().int().min(1).max(48).default(6),
  columns: z.union([z.literal(2), z.literal(3)]).default(3),
  /** Renders the working filter controls (class, bunks, slides, price). */
  showFilters: z.boolean().default(false),
  cta: ctaField,
})

const coachSpecTable = baseProps.extend({
  ...heading,
  /** Explains what the spec values mean; rows are the spec glossary. */
  rows: z.array(z.object({ term: z.string(), definition: z.string() })).default([]),
  showClassComparison: z.boolean().default(false),
})

const statCounters = baseProps.extend({
  ...heading,
  /** value is rendered as text in the HTML, never painted in by JS on scroll. */
  items: z.array(z.object({ value: z.string(), label: z.string(), detail: z.string().default('') })).default([]),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(4),
})

const featureGrid = baseProps.extend({
  ...heading,
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  items: z
    .array(
      z.object({
        icon: z.string().default('check'),
        title: z.string(),
        description: z.string(),
        image: imageField,
      }),
    )
    .default([]),
})

const stepsHowItWorks = baseProps.extend({
  ...heading,
  items: z
    .array(
      z.object({
        icon: z.string().default('check'),
        title: z.string(),
        description: z.string(),
        /** Where this step actually happens. Empty renders no link. */
        url: z.string().default(''),
        linkLabel: z.string().default(''),
      }),
    )
    .default([]),
  cta: ctaField,
})

const coverageMap = baseProps.extend({
  ...heading,
  /** The state and city lists render as real <a> links, not SVG paths alone. */
  statesHeading: z.string().default('States we serve'),
  states: z.array(z.object({ code: z.string(), name: z.string() })).default([]),
  marketsHeading: z.string().default('Primary markets'),
  markets: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  excludedNote: z.string().default(''),
  showMap: z.boolean().default(true),
  cta: ctaField,
})

const destinationGrid = baseProps.extend({
  ...heading,
  limit: z.number().int().min(1).max(48).default(8),
  hubsOnly: z.boolean().default(false),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(4),
  cta: ctaField,
})

const testimonials = baseProps.extend({
  ...heading,
  limit: z.number().int().min(1).max(24).default(4),
})

const faqAccordion = baseProps.extend({
  ...heading,
  /** Matches FaqItem.group. */
  group: z.string().default('home'),
  limit: z.number().int().min(1).max(40).default(12),
  /** The "still have questions" support card in the sticky left column. */
  supportTitle: z.string().default(''),
  supportBody: z.string().default(''),
  supportPhoneLabel: z.string().default(''),
  supportCta: ctaField,
  layout: z.enum(['split', 'stacked']).default('split'),
})

const ctaBanner = baseProps.extend({
  ...heading,
  ctas: z.array(cta).default([]),
  image: imageField,
})

const gallery = baseProps.extend({
  ...heading,
  /** Each image carries a figcaption that states the fact, not a filename. */
  items: z.array(image).default([]),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
})

const relatedPosts = baseProps.extend({
  ...heading,
  limit: z.number().int().min(1).max(12).default(3),
  categorySlug: z.string().default(''),
  excludeSlug: z.string().default(''),
})

const contactBlock = baseProps.extend({
  ...heading,
  showAddress: z.boolean().default(true),
  showPhone: z.boolean().default(true),
  showEmail: z.boolean().default(true),
  showHours: z.boolean().default(true),
  hoursLabel: z.string().default('24/7 dispatch'),
  mapEmbedUrl: z.string().default(''),
  mapTitle: z.string().default('Office location map'),
  formSlug: z.string().default('contact'),
  showForm: z.boolean().default(true),
})

const rawHtml = baseProps.extend({
  heading: z.string().default(''),
  html: z.string().default(''),
})

export const blockSchemas = {
  Hero: hero,
  RichText: richText,
  ServiceStatement: serviceStatement,
  QuoteForm: quoteForm,
  TrustStrip: trustStrip,
  ServiceCards: serviceCards,
  FleetGrid: fleetGrid,
  CoachSpecTable: coachSpecTable,
  StatCounters: statCounters,
  FeatureGrid: featureGrid,
  StepsHowItWorks: stepsHowItWorks,
  CoverageMap: coverageMap,
  DestinationGrid: destinationGrid,
  Testimonials: testimonials,
  FaqAccordion: faqAccordion,
  CtaBanner: ctaBanner,
  Gallery: gallery,
  RelatedPosts: relatedPosts,
  ContactBlock: contactBlock,
  RawHtml: rawHtml,
} as const satisfies Record<BlockType, z.ZodTypeAny>

export type BlockPropsMap = {
  [K in BlockType]: z.infer<(typeof blockSchemas)[K]>
}

export type AnyBlockProps = BlockPropsMap[BlockType]

export type BlockRecord<K extends BlockType = BlockType> = {
  id: string
  type: K
  order: number
  visible: boolean
  props: BlockPropsMap[K]
}

export function isBlockType(value: string): value is BlockType {
  return (BLOCK_TYPES as readonly string[]).includes(value)
}

/**
 * Parses stored props, filling defaults. Returns null for unknown block types so
 * a bad row can never crash a page render.
 */
export function parseBlock(type: string, props: unknown): AnyBlockProps | null {
  if (!isBlockType(type)) return null
  const parsed = blockSchemas[type].safeParse(props ?? {})
  return parsed.success ? (parsed.data as AnyBlockProps) : (blockSchemas[type].parse({}) as AnyBlockProps)
}

/**
 * Alt-text gate. An image cannot be saved into content without alt text; an
 * empty string is allowed only when `decorative` was explicitly chosen.
 * Applied by the block write API to every image field, at any nesting depth.
 */
export function requireAlt(value: unknown, pathLabel = 'props'): string[] {
  const errors: string[] = []
  const walk = (node: unknown, at: string): void => {
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${at}[${i}]`))
      return
    }
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, unknown>
    if (typeof obj.src === 'string' && obj.src.trim() !== '') {
      const alt = typeof obj.alt === 'string' ? obj.alt.trim() : ''
      const decorative = obj.decorative === true
      if (!alt && !decorative) {
        errors.push(`${at}: image "${obj.src}" needs alt text (or must be marked decorative)`)
      }
    }
    for (const [key, child] of Object.entries(obj)) {
      if (key === 'src' || key === 'alt') continue
      walk(child, `${at}.${key}`)
    }
  }
  walk(value, pathLabel)
  return errors
}
