/**
 * Writes the live fleet back into prisma/seed-data/coaches.json.
 *
 *   npx tsx scripts/sync-fleet-snapshot.mts
 *
 * The seed rebuilds the Coach table from that file. Until it matches the
 * database, running `prisma db seed` would restore the six placeholder coaches
 * and drop the twenty-one real ones, so this keeps the snapshot and the
 * database saying the same thing.
 *
 * Run it after any fleet change made through /admin or a script.
 */

import { writeFileSync } from 'node:fs'
import { withDb } from './_db.mts'

const OUT = new URL('../prisma/seed-data/coaches.json', import.meta.url)

await withDb(async (prisma) => {
  const coaches = await prisma.coach.findMany({
    orderBy: { displayOrder: 'asc' },
    include: {
      class: { select: { name: true } },
      images: { orderBy: { order: 'asc' }, include: { media: { select: { path: true } } } },
    },
  })

  const records = coaches.map((c) => ({
    slug: c.slug,
    name: c.name,
    className: c.class?.name ?? 'Entertainer coach',
    chassis: c.chassis,
    bunks: c.bunks,
    slideOuts: c.slideOuts,
    rearConfig: c.rearConfig,
    amenities: c.amenities,
    dailyPrice: c.dailyPrice,
    tagline: c.tagline,
    description: c.description,
    images: c.images.map((i) => i.media.path),
    featured: c.featured,
    displayOrder: c.displayOrder,
  }))

  writeFileSync(OUT, `${JSON.stringify(records, null, 2)}\n`, 'utf8')
  console.log(`\n  wrote ${records.length} coaches to prisma/seed-data/coaches.json`)
  console.log(`  ${records.filter((r) => r.images.length).length} carry a photograph\n`)
})
