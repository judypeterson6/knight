/**
 * Repoints the migration snapshot at files that were re-encoded to WebP.
 *
 *   npx tsx scripts/sync-media-snapshot.mts
 *
 * optimize-uploads.mts rewrites the files on disk, the Media rows and the live
 * block props. The snapshot in prisma/seed-data is the seed's source of truth
 * and is not covered by any of that, so left alone it still names the deleted
 * PNGs. `npm run verify` fails, and a re-seed would rebuild every block
 * pointing at files that no longer exist.
 *
 * This updates media.json entries, then rewrites those same paths wherever
 * they are referenced elsewhere in the snapshot: page image lists, migrated
 * body HTML, post featured images and coach galleries. Only paths whose PNG is
 * actually gone and whose WebP exists are touched.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

interface MediaRecord {
  path: string
  filename: string
  mimeType: string
  bytes: number | null
  width: number | null
  height: number | null
  [key: string]: unknown
}

const ROOT = process.cwd()
const DATA = path.join(ROOT, 'prisma', 'seed-data')
const PUBLIC = path.join(ROOT, 'public')

const mediaPath = path.join(DATA, 'media.json')
const records = JSON.parse(readFileSync(mediaPath, 'utf8')) as MediaRecord[]

/** old public path -> new public path, for every file actually converted. */
const moved = new Map<string, string>()
let stillMissing = 0

for (const record of records) {
  // Already repointed by an earlier run: remember the mapping so references
  // elsewhere in the snapshot still get rewritten.
  if (/\.webp$/i.test(record.path)) {
    const png = record.path.replace(/\.webp$/i, '.png')
    if (!existsSync(path.join(PUBLIC, png.replace(/^\//, '')))) moved.set(png, record.path)
    continue
  }
  if (!/\.png$/i.test(record.path)) continue

  const onDisk = path.join(PUBLIC, record.path.replace(/^\//, ''))
  if (existsSync(onDisk)) continue

  const webpPublic = record.path.replace(/\.png$/i, '.webp')
  const webpDisk = path.join(PUBLIC, webpPublic.replace(/^\//, ''))
  if (!existsSync(webpDisk)) {
    stillMissing += 1
    continue
  }

  const meta = await sharp(webpDisk).metadata()
  moved.set(record.path, webpPublic)
  record.path = webpPublic
  record.filename = path.basename(webpPublic)
  record.mimeType = 'image/webp'
  record.bytes = statSync(webpDisk).size
  record.width = meta.width ?? record.width
  record.height = meta.height ?? record.height
}

writeFileSync(mediaPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8')
console.log(`\n  media.json entries repointed : ${moved.size}`)
if (stillMissing) console.log(`  genuinely missing on disk    : ${stillMissing}`)

// Rewrite the same paths anywhere else in the snapshot. Whole-file string
// replacement is safe here: these are unique upload paths, not substrings that
// occur incidentally.
for (const file of ['pages.json', 'posts.json', 'coaches.json', 'locations.json']) {
  const full = path.join(DATA, file)
  if (!existsSync(full)) continue
  let text = readFileSync(full, 'utf8')
  let hits = 0
  for (const [from, to] of moved) {
    if (!text.includes(from)) continue
    hits += text.split(from).length - 1
    text = text.split(from).join(to)
  }
  if (!hits) continue
  writeFileSync(full, text, 'utf8')
  console.log(`  ${file.padEnd(28)} ${hits} references rewritten`)
}

console.log('')
