/**
 * Removes the placeholder people from /about-us and replaces them with a
 * section that is true.
 *
 *   npx tsx scripts/fix-about-team.mts
 *
 * The migration carried across "Ivan Itchinos" and "Mark Ateer" as staff. They
 * are joke names from the WordPress theme's demo content, and each arrived as
 * its own RichText block with the person's name set as an H2, so two invented
 * people were sitting in the page outline as top-level sections.
 *
 * Naming real staff would be better, but inventing replacements would repeat
 * the original mistake. So the section instead states what can be verified
 * from the operator's own published material: the dispatch cover, the driver
 * standard, the fleet policy and the compliance position. Every claim here
 * already appears elsewhere on the site.
 *
 * Add real people from /admin whenever you have names, roles and photographs.
 */

import { withDb } from './_db.mts'
import { blockSchemas } from '../src/lib/blocks/schema'

const PLACEHOLDER = /Itchinos|Ateer/i

await withDb(async (prisma) => {
  const page = await prisma.page.findFirst({
    where: { path: '/about-us' },
    include: { blocks: { orderBy: { order: 'asc' } } },
  })
  if (!page) {
    console.log('\n  /about-us not found\n')
    return
  }

  const doomed = page.blocks.filter((b) => {
    const props = b.props as Record<string, unknown>
    return PLACEHOLDER.test(String(props.heading ?? '')) || String(props.heading ?? '') === 'Our Expert Team'
  })

  console.log('\n  removing:')
  for (const b of doomed) console.log(`    ${b.type}  "${String((b.props as Record<string, unknown>).heading ?? '')}"`)

  // A stray placeholder name also sits as an <h3> inside the founding-story
  // block, which is why that section has a person's name in the middle of it.
  const story = page.blocks.find((b) => PLACEHOLDER.test(String((b.props as Record<string, unknown>).html ?? '')))
  if (story && !doomed.includes(story)) {
    const props = story.props as Record<string, unknown>
    const cleaned = String(props.html ?? '').replace(/<h3[^>]*>\s*(?:Ivan Itchinos|Mark Ateer)\s*<\/h3>/gi, '')
    await prisma.pageBlock.update({ where: { id: story.id }, data: { props: { ...props, html: cleaned } } })
    console.log(`    (stray <h3> removed from "${String(props.heading ?? '').slice(0, 40)}")`)
  }

  const team = blockSchemas.FeatureGrid.parse({
    background: 'alt',
    spacing: 'md',
    align: 'center',
    eyebrow: 'How the operation runs',
    heading: 'Who looks after your tour',
    headingLevel: 'h2',
    body: 'Every coach leaves under the same standard, whoever is driving it and wherever the routing goes.',
    columns: 4,
    items: [
      {
        icon: 'headset',
        title: 'Dispatch, 24 hours',
        description:
          'A live person answers routing changes, breakdown calls and last-minute schedule moves around the clock, not a ticket queue.',
      },
      {
        icon: 'id-card',
        title: 'Drivers who know the work',
        description:
          'CDL with passenger endorsement, a current DOT medical card, FMCSA Drug and Alcohol Clearinghouse enrollment, and at least three years on entertainer coaches.',
      },
      {
        icon: 'screwdriver-wrench',
        title: 'Maintenance before departure',
        description:
          'Mechanical, fluid and tire checks before every pickup, on a Prevost-only fleet so one parts inventory and one trained skill set covers every unit.',
      },
      {
        icon: 'shield-halved',
        title: 'Compliance on record',
        description:
          'Operating under its own US DOT number with Entertainer Motorcoach Council membership, which is checkable in the FMCSA SAFER system.',
      },
    ],
  })

  const keep = page.blocks.filter((b) => !doomed.includes(b))
  const at = Math.min(...doomed.map((b) => b.order))

  await prisma.$transaction([
    prisma.pageBlock.deleteMany({ where: { id: { in: doomed.map((b) => b.id) } } }),
    ...keep.map((b, i) =>
      prisma.pageBlock.update({ where: { id: b.id }, data: { order: i >= at ? i + 1 : i } }),
    ),
    prisma.pageBlock.create({
      data: { pageId: page.id, type: 'FeatureGrid', order: at, visible: true, props: team as object },
    }),
  ])

  const after = await prisma.pageBlock.findMany({
    where: { pageId: page.id },
    orderBy: { order: 'asc' },
    select: { type: true, props: true },
  })
  console.log('\n  /about-us now:')
  for (const [i, b] of after.entries()) {
    console.log(`    ${String(i).padStart(2)}. ${b.type.padEnd(18)} ${String((b.props as Record<string, unknown>).heading ?? '').slice(0, 50)}`)
  }
  console.log('\n  Clear .next/cache or save the page from /admin to refresh.\n')
})
