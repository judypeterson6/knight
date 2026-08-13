/**
 * Replaces the seeded fleet with the operator's real one.
 *
 *   npx tsx scripts/rebuild-fleet.mts
 *
 * The seed shipped six coaches. Three of them (Maverick, Pioneer, Summit) were
 * invented, and they reused Outlaw's, Atlas's and Thunder's photographs, so the
 * site was showing the same three buses under six names. The specs were
 * invented too: bunk counts of 8, 10 and 14, double and triple slides, and a
 * chassis split between the X3-45 and the H3-45.
 *
 * The real fleet is in the migration snapshot. prisma/seed-data/pages.json
 * holds the WordPress /fleet page, which lists twenty-one coaches, each with
 * its own photograph and a spec line. Every one of them reads "12 Bunk Single
 * Slide Out", except Wisdom, Brookland and Chief, which read "12 Bunk With
 * Optional Star Conversion".
 *
 * So this rebuilds the table from that source and nothing else:
 *
 *   - Names and order come from the fleet page.
 *   - Bunks are 12 for all twenty-one, because that is what the source says.
 *   - slideOuts and rearConfig carry only what the source states for that
 *     coach, and are left empty otherwise. The fleet grid and the spec table
 *     skip empty values rather than filling them in.
 *   - chassis is "Prevost", which the site claims fleet-wide. The source never
 *     names an X3-45 or an H3-45 per coach, so neither does this.
 *   - dailyPrice stays null. The old site published no per-coach rate, and the
 *     schema treats "quoted per tour" as a legitimate state.
 *   - amenities are the fleet-wide list already in use, which matches the
 *     twelve-bunk configuration and is claimed for every coach on the site.
 *
 * Every coach lands in one class, because the source does not grade the fleet
 * into tiers. The class control on /fleet hides itself when there is only one.
 */

import { withDb } from './_db.mts'

type Config = 'slide' | 'star'

/** Name, image family (the WordPress basename minus its size suffix), config. */
const FLEET: [string, string, Config][] = [
  ['Prowler', 'Prowler-Entertainer-Coach-1', 'slide'],
  ['Outlaw', 'Outlaw-Tour-Bus', 'slide'],
  ['Atlas', 'Atlas-Entertainer-Coach-Prevost', 'slide'],
  ['Thunder', 'Thunder-Entertainer-Coach-Slide', 'slide'],
  ['Cowboy', 'Cowboy-Entertainer-Coach', 'slide'],
  ['Wicked', 'Wicked-Entertainer-Coach', 'slide'],
  ['Midnight', 'Midnight-Tour-Bus-For-Lease', 'slide'],
  ['Twister', 'Twister-Entertainer-Coach', 'slide'],
  ['Ruby', 'Ruby-Entertainer-Coach-Slide', 'slide'],
  ['Raven', 'Raven-Elite-Prevost-Entertainer-Coach', 'slide'],
  ['Betty', 'Betty-Entertainer-Coach', 'slide'],
  ['Ike', 'Ike-Entertainer-Coach-Rental-1', 'slide'],
  ['Jayhawk', 'Jayhawk-Tour-Bus-For-Lease', 'slide'],
  ['Wildcat', 'Wildcat-Entertainer-Coach', 'slide'],
  ['Tin Man', 'Tin-Man-Entertainer-Coach', 'slide'],
  ['Toto', 'Toto-Entertainer-Coach', 'slide'],
  ['Shocker', 'Shocker-Entertainer-Coach', 'slide'],
  ['Wisdom', 'Wisdom', 'star'],
  ['Paladin', 'Paladin-Entertainer-Coach', 'slide'],
  ['Brookland', 'Brookland-Entertainer-Coach', 'star'],
  ['Chief', 'Chief-Entertainer-Coach', 'star'],
]

const AMENITIES = [
  '12 curtained sleeper bunks',
  'Full galley with refrigeration and prep space',
  'Front lounge and private rear lounge',
  'Stand-up bathroom with onboard shower',
  'Entertainment system and onboard Wi-Fi',
  'Independent climate control zones',
  'CDL-certified professional driver included',
]

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function describe(name: string, config: Config): string {
  const layout =
    config === 'star'
      ? 'twelve bunks with an optional star conversion, so the rear can be run as bunks or opened up as a private star suite'
      : 'twelve bunks and a single slide-out that widens the main lounge once the coach is parked'
  return (
    `${name} is a Prevost entertainer coach converted with ${layout}. ` +
    'It carries a full galley, a front lounge and a private rear lounge, and a stand-up bathroom with an onboard shower, ' +
    'so the crew sleeps and eats on board while the coach moves between cities. ' +
    'Every booking includes a CDL-certified driver and 24/7 dispatch. Rates are quoted per tour against your routing and dates.'
  )
}

await withDb(async (prisma) => {
  // One class, because the source does not tier the fleet.
  const cls =
    (await prisma.coachClass.findUnique({ where: { slug: 'entertainer-coach' } })) ??
    (await prisma.coachClass.create({
      data: {
        slug: 'entertainer-coach',
        name: 'Entertainer coach',
        description: 'Prevost entertainer coach conversions, twelve bunks, driven by a CDL-certified driver.',
        order: 0,
      },
    }))

  // Resolve each image family to the widest file actually on disk.
  const media = await prisma.media.findMany({
    where: { mimeType: { startsWith: 'image/' } },
    select: { id: true, path: true, filename: true, width: true },
  })

  const pickImage = (family: string) => {
    const candidates = media.filter((m) => {
      const base = m.filename.replace(/\.(webp|jpe?g|png|avif)$/i, '')
      return base === family || base.startsWith(`${family}-`)
    })
    // Reject a longer name that is really a different coach ("Wisdom" must not
    // swallow "Wisdom-Teeth"): only a size suffix may follow the family.
    const sized = candidates.filter((m) => {
      const base = m.filename.replace(/\.(webp|jpe?g|png|avif)$/i, '')
      return base === family || /^-\d+x\d+$/.test(base.slice(family.length))
    })
    const pool = sized.length ? sized : candidates
    return pool.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0] ?? null
  }

  const keepSlugs = new Set(FLEET.map(([name]) => slugify(name)))
  const existing = await prisma.coach.findMany({ select: { id: true, slug: true } })
  const doomed = existing.filter((c) => !keepSlugs.has(c.slug))

  console.log(`\n  fleet source: ${FLEET.length} coaches`)
  if (doomed.length) console.log(`  removing invented coaches: ${doomed.map((c) => c.slug).join(', ')}`)

  const missing: string[] = []
  let order = 0

  for (const [name, family, config] of FLEET) {
    const slug = slugify(name)
    const image = pickImage(family)
    if (!image) missing.push(`${name} (${family})`)

    const data = {
      name,
      classId: cls.id,
      chassis: 'Prevost',
      bunks: 12,
      slideOuts: config === 'slide' ? 'Single slide out' : '',
      rearConfig: config === 'star' ? 'Optional star conversion' : '',
      amenities: AMENITIES,
      description: describe(name, config),
      tagline: null,
      dailyPrice: null,
      available: true,
      featured: order < 3,
      displayOrder: order,
      status: 'PUBLISHED' as const,
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    }

    const coach = await prisma.coach.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    })

    if (image) {
      // One photograph per coach, which is all the source provides. Replacing
      // rather than adding keeps a re-run idempotent.
      await prisma.coachImage.deleteMany({ where: { coachId: coach.id, NOT: { mediaId: image.id } } })
      await prisma.coachImage.upsert({
        where: { coachId_mediaId: { coachId: coach.id, mediaId: image.id } },
        create: { coachId: coach.id, mediaId: image.id, order: 0, caption: `${name}, a Prevost entertainer coach` },
        update: { order: 0, caption: `${name}, a Prevost entertainer coach` },
      })
    }

    console.log(`   ${String(order + 1).padStart(2)}. ${name.padEnd(10)} ${config === 'star' ? 'star conv.' : 'single slide'}  ${image ? image.path.split('/').pop() : 'NO IMAGE'}`)
    order += 1
  }

  // The three invented slugs were reachable, so they get a redirect rather
  // than a 404.
  for (const c of doomed) {
    await prisma.redirect.upsert({
      where: { from: `/fleet/${c.slug}` },
      create: { from: `/fleet/${c.slug}`, to: '/fleet', kind: 'PERMANENT', note: 'Seeded placeholder coach removed' },
      update: { to: '/fleet', enabled: true },
    })
  }
  await prisma.coach.deleteMany({ where: { id: { in: doomed.map((c) => c.id) } } })

  if (missing.length) console.log(`\n  WARNING, no image found for: ${missing.join(', ')}`)

  const total = await prisma.coach.count()
  const withImage = await prisma.coach.count({ where: { images: { some: {} } } })
  console.log(`\n  ${total} coaches, ${withImage} with a photograph\n`)
})
