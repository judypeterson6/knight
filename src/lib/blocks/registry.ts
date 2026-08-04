import { BLOCK_TYPES, blockSchemas, type BlockType } from '@/lib/blocks/schema'

/**
 * Admin-facing metadata for the block library.
 *
 * The renderer (src/components/blocks/index.tsx) maps type -> component; this
 * maps type -> label, description, category and default props, which is what
 * the block-library rail and the right-hand inspector in /admin render from.
 *
 * To add a block type: add its schema in schema.ts, add an entry here, add the
 * component and register it in the renderer. See README "Adding a block type".
 */

export type BlockCategory = 'Layout' | 'Content' | 'Conversion' | 'Proof' | 'Fleet' | 'Geography' | 'Advanced'

export interface BlockMeta {
  type: BlockType
  label: string
  description: string
  category: BlockCategory
  icon: string
  /** Blocks that pull their own rows from the database rather than from props. */
  dataDriven: boolean
}

export const BLOCK_META: Record<BlockType, BlockMeta> = {
  Hero: {
    type: 'Hero',
    label: 'Hero',
    description:
      'Page centerpiece. The landing variant carries the H1, the service statement, an inline quote form and the trust stats above the fold.',
    category: 'Layout',
    icon: 'bus',
    dataDriven: false,
  },
  RichText: {
    type: 'RichText',
    label: 'Rich text',
    description: 'Heading, body copy and optional paired image. Holds migrated WordPress body content.',
    category: 'Content',
    icon: 'file-lines',
    dataDriven: false,
  },
  ServiceStatement: {
    type: 'ServiceStatement',
    label: 'Service statement',
    description: 'Two or three factual sentences: what is provided, on what equipment, over what area.',
    category: 'Content',
    icon: 'check',
    dataDriven: false,
  },
  QuoteForm: {
    type: 'QuoteForm',
    label: 'Quote form',
    description: 'Inline quote request form, rendered from a Form definition.',
    category: 'Conversion',
    icon: 'file-signature',
    dataDriven: true,
  },
  TrustStrip: {
    type: 'TrustStrip',
    label: 'Trust strip',
    description: 'Certifications and capabilities as text labels. Reads the editable trust records by default.',
    category: 'Proof',
    icon: 'shield-halved',
    dataDriven: true,
  },
  ServiceCards: {
    type: 'ServiceCards',
    label: 'Service cards',
    description: 'Linked service cards forming the internal link mesh. Every card must point at a real page.',
    category: 'Layout',
    icon: 'bus',
    dataDriven: false,
  },
  FleetGrid: {
    type: 'FleetGrid',
    label: 'Fleet grid',
    description: 'Coach cards from the fleet, optionally with working class / bunk / slide / price filters.',
    category: 'Fleet',
    icon: 'bus',
    dataDriven: true,
  },
  CoachSpecTable: {
    type: 'CoachSpecTable',
    label: 'Coach spec table',
    description: 'Class comparison table plus a glossary explaining what each spec value means.',
    category: 'Fleet',
    icon: 'bed',
    dataDriven: true,
  },
  StatCounters: {
    type: 'StatCounters',
    label: 'Stat counters',
    description: 'Numbers and labels as real text. Never animated in by JavaScript alone.',
    category: 'Proof',
    icon: 'circle-check',
    dataDriven: false,
  },
  FeatureGrid: {
    type: 'FeatureGrid',
    label: 'Feature grid',
    description: 'Differentiators. Each block should state a verifiable fact.',
    category: 'Proof',
    icon: 'gem',
    dataDriven: false,
  },
  StepsHowItWorks: {
    type: 'StepsHowItWorks',
    label: 'How it works',
    description: 'Numbered booking steps as an ordered list.',
    category: 'Content',
    icon: 'route',
    dataDriven: false,
  },
  CoverageMap: {
    type: 'CoverageMap',
    label: 'Coverage map',
    description: 'Coverage cartogram plus the state and market lists as crawlable text links.',
    category: 'Geography',
    icon: 'map-location-dot',
    dataDriven: false,
  },
  DestinationGrid: {
    type: 'DestinationGrid',
    label: 'Destination grid',
    description: 'City cards from the Location table. Every card links to its own page.',
    category: 'Geography',
    icon: 'location-dot',
    dataDriven: true,
  },
  Testimonials: {
    type: 'Testimonials',
    label: 'Testimonials',
    description: 'Published reviews with name, role and rating as text.',
    category: 'Proof',
    icon: 'star',
    dataDriven: true,
  },
  FaqAccordion: {
    type: 'FaqAccordion',
    label: 'FAQ accordion',
    description: 'FAQ items for a group. Answers ship in the initial HTML and collapse after render.',
    category: 'Content',
    icon: 'headset',
    dataDriven: true,
  },
  CtaBanner: {
    type: 'CtaBanner',
    label: 'CTA banner',
    description: 'Full-width call to action with up to two buttons.',
    category: 'Conversion',
    icon: 'phone',
    dataDriven: false,
  },
  Gallery: {
    type: 'Gallery',
    label: 'Gallery',
    description: 'Image grid. Each image carries a figcaption stating the fact it shows.',
    category: 'Content',
    icon: 'gem',
    dataDriven: false,
  },
  RelatedPosts: {
    type: 'RelatedPosts',
    label: 'Related reading',
    description: 'Recent posts, optionally scoped to a category.',
    category: 'Content',
    icon: 'file-lines',
    dataDriven: true,
  },
  ContactBlock: {
    type: 'ContactBlock',
    label: 'Contact block',
    description: 'Phone, email, postal address and the contact form.',
    category: 'Conversion',
    icon: 'envelope',
    dataDriven: true,
  },
  RawHtml: {
    type: 'RawHtml',
    label: 'Raw HTML',
    description: 'Escape hatch for embeds. Sanitised before render.',
    category: 'Advanced',
    icon: 'file-lines',
    dataDriven: false,
  },
}

export const BLOCK_LIBRARY: BlockMeta[] = BLOCK_TYPES.map((type) => BLOCK_META[type])

export const BLOCK_CATEGORIES: BlockCategory[] = [
  'Layout',
  'Content',
  'Conversion',
  'Proof',
  'Fleet',
  'Geography',
  'Advanced',
]

/** Zod-parsed empty props — used when an editor inserts a fresh block. */
export function defaultPropsFor(type: BlockType): Record<string, unknown> {
  return blockSchemas[type].parse({}) as Record<string, unknown>
}
