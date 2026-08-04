import type { BlockContext } from '@/lib/blocks/context'
import { parseBlock, type BlockType } from '@/lib/blocks/schema'
import { CtaBannerBlock, HeroBlock, QuoteFormBlock, ServiceStatementBlock, TrustStripBlock } from '@/components/blocks/hero'
import { GalleryBlock, RawHtmlBlock, RichTextBlock } from '@/components/blocks/content'
import {
  FeatureGridBlock,
  ServiceCardsBlock,
  StatCountersBlock,
  StepsHowItWorksBlock,
  TestimonialsBlock,
} from '@/components/blocks/proof'
import { CoachSpecTableBlock, FleetGridBlock } from '@/components/blocks/fleet'
import { CoverageMapBlock, DestinationGridBlock } from '@/components/blocks/geo'
import { ContactBlockBlock, FaqAccordionBlock, RelatedPostsBlock } from '@/components/blocks/interactive'

export interface StoredBlock {
  id: string
  type: string
  order: number
  visible: boolean
  props: unknown
}

/**
 * Renders one stored block.
 *
 * Props are re-parsed through the block's Zod schema on every render, so a row
 * written by an older schema version fills in defaults rather than crashing the
 * page. An unknown block type renders nothing.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
async function renderBlock(block: StoredBlock, ctx: BlockContext, first: boolean) {
  const props = parseBlock(block.type, block.props)
  if (!props) return null
  const type = block.type as BlockType
  const p = props as any

  switch (type) {
    case 'Hero':
      return <HeroBlock props={p} first={first} />
    case 'RichText':
      return <RichTextBlock props={p} />
    case 'ServiceStatement':
      return <ServiceStatementBlock props={p} />
    case 'QuoteForm':
      return <QuoteFormBlock props={p} />
    case 'TrustStrip':
      return <TrustStripBlock props={p} />
    case 'ServiceCards':
      return <ServiceCardsBlock props={p} />
    case 'FleetGrid':
      return <FleetGridBlock props={p} ctx={ctx} />
    case 'CoachSpecTable':
      return <CoachSpecTableBlock props={p} />
    case 'StatCounters':
      return <StatCountersBlock props={p} />
    case 'FeatureGrid':
      return <FeatureGridBlock props={p} />
    case 'StepsHowItWorks':
      return <StepsHowItWorksBlock props={p} />
    case 'CoverageMap':
      return <CoverageMapBlock props={p} />
    case 'DestinationGrid':
      return <DestinationGridBlock props={p} />
    case 'Testimonials':
      return <TestimonialsBlock props={p} />
    case 'FaqAccordion':
      return <FaqAccordionBlock props={p} />
    case 'CtaBanner':
      return <CtaBannerBlock props={p} />
    case 'Gallery':
      return <GalleryBlock props={p} />
    case 'RelatedPosts':
      return <RelatedPostsBlock props={p} ctx={ctx} />
    case 'ContactBlock':
      return <ContactBlockBlock props={p} />
    case 'RawHtml':
      return <RawHtmlBlock props={p} />
    default:
      return null
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function BlockRenderer({ blocks, ctx }: { blocks: StoredBlock[]; ctx: BlockContext }) {
  const visible = blocks.filter((b) => b.visible).sort((a, b) => a.order - b.order)
  const rendered = await Promise.all(visible.map((block, i) => renderBlock(block, ctx, i === 0)))
  return (
    <>
      {rendered.map((node, i) => (
        <div key={visible[i].id} data-block-id={visible[i].id} data-block-type={visible[i].type}>
          {node}
        </div>
      ))}
    </>
  )
}
