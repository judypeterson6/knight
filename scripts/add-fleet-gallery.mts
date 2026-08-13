/**
 * Adds the fleet gallery and the interior showcase, and fixes the two bunk
 * claims that now contradict the page they sit on.
 *
 *   npx tsx scripts/add-fleet-gallery.mts
 *
 * Gallery. /fleet already lists every coach as a card with its spec. The
 * gallery is the visual index above it: all twenty-one photographs at four
 * across, each captioned with the coach's name, so someone who wants to look
 * rather than read can see the whole fleet in one screen.
 *
 * Interiors. Only four genuine entertainer-coach interior photographs exist in
 * the library. The rest of what the media table calls an "interior" is stock
 * imagery of ordinary intercity buses, which would misrepresent a Prevost
 * conversion, so it is not used. Four real ones, or nothing.
 *
 * Bunk claims. Rebuilding the fleet from the operator's own /fleet page set
 * every coach to twelve bunks, which is what that page's spec line says. Body
 * copy elsewhere on the site says "6 to 14 bunks" in about thirty-five places.
 * Both came from the same WordPress site, so they cannot both be right, and
 * picking one by guesswork across thirty-five passages is not a decision this
 * script should make. It corrects only the two places where the claim sits on
 * the same page as the spec that now contradicts it — the home hero, directly
 * above the fleet grid, and the /fleet spec table, directly above a table
 * showing twelve for every coach. The rest is left for the operator to confirm.
 */

import { withDb } from './_db.mts'
import { blockSchemas } from '../src/lib/blocks/schema'

/** The only interior photographs that actually show an entertainer coach. */
const INTERIORS: [string, string, string][] = [
  [
    'Floor-Plans-and-Interior-Layouts-Entertainer-Coach-Rental',
    'The main lounge of a Prevost entertainer coach with the slide-out extended',
    'Front lounge with the slide-out extended, which is where the crew sits between dates.',
  ],
  [
    'Custom-Interiors-and-Branding-Options-Entertainer-Coach-Rental',
    'A custom-converted entertainer coach interior finished in wood and leather',
    'Conversions are finished to order, so no two coaches in the fleet read the same inside.',
  ],
  [
    'A-Calm-Smoke-Free-Lounge-Between-Dates-Christian-and-Gospel-Music-Tour-Bus-Rental',
    'A smoke-free rear lounge on a Prevost entertainer coach',
    'A private rear lounge, kept smoke-free on request, separate from the bunk area.',
  ],
  [
    'A-Studio-Adjacent-Lounge-for-the-Long-Drives-DJ-Tour-Bus-Rental',
    'A lounge set up for working on the move during a long overnight drive',
    'Lounge space set up for working through the long overnight legs.',
  ],
]

await withDb(async (prisma) => {
  const media = await prisma.media.findMany({
    where: { mimeType: { startsWith: 'image/' } },
    select: { path: true, filename: true, width: true, height: true },
  })

  /** Widest file in an image family, so the gallery is not fed a thumbnail. */
  const widest = (family: string) => {
    const pool = media.filter((m) => {
      const base = m.filename.replace(/\.(webp|jpe?g|png|avif)$/i, '')
      return base === family || /^-\d+x\d+$/.test(base.slice(family.length))
    })
    return pool.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0] ?? null
  }

  // ------------------------------------------------------------- gallery ---
  const coaches = await prisma.coach.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { displayOrder: 'asc' },
    include: { images: { orderBy: { order: 'asc' }, take: 1, include: { media: true } } },
  })

  const galleryItems = coaches
    .filter((c) => c.images[0])
    .map((c) => {
      const m = c.images[0].media
      return {
        src: m.path,
        alt: `${c.name}, a Prevost entertainer coach in the Knights Coaches fleet`,
        width: m.width ?? 1024,
        height: m.height ?? 691,
        caption: c.name,
        decorative: false,
      }
    })

  const interiorItems = INTERIORS.flatMap(([family, alt, caption]) => {
    const m = widest(family)
    if (!m) return []
    return [{ src: m.path, alt, width: m.width ?? 1024, height: m.height ?? 576, caption, decorative: false }]
  })

  const fleet = await prisma.page.findFirst({
    where: { path: '/fleet' },
    include: { blocks: { orderBy: { order: 'asc' } } },
  })
  if (!fleet) throw new Error('/fleet is missing')

  const gallery = {
    type: 'Gallery',
    props: blockSchemas.Gallery.parse({
      background: 'alt',
      spacing: 'lg',
      align: 'center',
      anchor: 'fleet-gallery',
      eyebrow: 'Fleet gallery',
      heading: 'Every coach in the fleet',
      headingLevel: 'h2',
      body: `All ${galleryItems.length} coaches. Specifications and booking for each one are in the listing below.`,
      columns: 4,
      items: galleryItems,
    }) as object,
  }

  const interiors = {
    type: 'Gallery',
    props: blockSchemas.Gallery.parse({
      background: 'surface',
      spacing: 'lg',
      align: 'center',
      anchor: 'coach-interiors',
      eyebrow: 'Inside the coaches',
      heading: 'What the interiors look like',
      headingLevel: 'h2',
      body: 'Lounges, layouts and finish. Conversions are built to order, so treat these as representative of the fleet rather than of one specific coach.',
      columns: 2,
      items: interiorItems,
    }) as object,
  }

  // Gallery goes directly under the hero, ahead of the detailed listing.
  const rest = fleet.blocks.filter((b) => b.type !== 'Gallery')
  const heroAt = rest.findIndex((b) => b.type === 'Hero')
  const specAt = rest.findIndex((b) => b.type === 'CoachSpecTable')

  const ordered: { id?: string; type: string; props: object }[] = []
  for (const [i, b] of rest.entries()) {
    ordered.push({ id: b.id, type: b.type, props: b.props as object })
    if (i === heroAt) ordered.push(gallery)
    if (i === specAt) ordered.push(interiors)
  }

  await prisma.pageBlock.deleteMany({ where: { pageId: fleet.id } })
  for (const [i, b] of ordered.entries()) {
    await prisma.pageBlock.create({
      data: { pageId: fleet.id, type: b.type, order: i, visible: true, props: b.props },
    })
  }

  console.log(`\n  /fleet rebuilt:`)
  for (const [i, b] of ordered.entries()) console.log(`   ${String(i).padStart(2)}. ${b.type}`)
  console.log(`\n  gallery: ${galleryItems.length} coaches`)
  console.log(`  interiors: ${interiorItems.length} photographs`)
  if (interiorItems.length < INTERIORS.length) {
    console.log('  WARNING: an interior image family was not found in the media library')
  }

  // -------------------------------------------------------- bunk claims ---
  let fixed = 0
  const targets = await prisma.pageBlock.findMany({
    where: { OR: [{ page: { path: '/' }, type: 'Hero' }, { page: { path: '/fleet' }, type: 'CoachSpecTable' }] },
    include: { page: { select: { path: true } } },
  })

  for (const b of targets) {
    const before = JSON.stringify(b.props)
    const after = before
      .replace(/\b6 to 14 bunks\b/g, '12 bunks')
      .replace(/\b6 to 14 bunk configurations\b/g, '12-bunk configurations')
    if (after !== before) {
      await prisma.pageBlock.update({ where: { id: b.id }, data: { props: JSON.parse(after) } })
      console.log(`  corrected bunk claim in ${b.type} on ${b.page?.path}`)
      fixed += 1
    }
  }

  // The home h1 carries an em-dash, which the site's own copy rules exclude.
  const homeHero = await prisma.pageBlock.findFirst({ where: { page: { path: '/' }, type: 'Hero' } })
  if (homeHero) {
    const props = homeHero.props as Record<string, unknown>
    const heading = String(props.heading ?? '')
    const next = heading.replace(/\s+[—–]\s+/g, ' | ')
    if (next !== heading) {
      await prisma.pageBlock.update({ where: { id: homeHero.id }, data: { props: { ...props, heading: next } } })
      console.log(`  home h1: "${next}"`)
    }
  }

  console.log(`\n  ${fixed} bunk claims corrected where they contradicted the page they sit on\n`)
})
