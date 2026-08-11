/**
 * Re-encodes oversized PNG photographs in /public/uploads as WebP.
 *
 *   npx tsx scripts/optimize-uploads.mts --dry-run     # report only, default
 *   npx tsx scripts/optimize-uploads.mts --apply       # actually rewrite
 *
 * The WordPress migration brought across photographs saved as PNG, several
 * running 2 to 3 MB each against a 251 MB library. Next optimises them on
 * request, but it has to read the original first, and the originals also sit
 * in every deploy and backup.
 *
 * What this does: for each PNG over the size threshold that is a photograph
 * rather than a logo or icon, write a WebP beside it, repoint the Media row and
 * any block prop referencing the old path, then delete the PNG. Transparency is
 * preserved by WebP, so logos would survive too, but they are skipped anyway
 * because re-encoding a small flat-colour image gains nothing.
 *
 * Non-destructive by default. Nothing is written or deleted without --apply.
 */

import { readdir, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { createClient } from './_db.mts'

const prisma = createClient()
const ROOT = process.cwd()
const UPLOADS = path.join(ROOT, 'public', 'uploads')

const APPLY = process.argv.includes('--apply')
/** Below this, re-encoding is not worth a database write. */
const MIN_BYTES = 300 * 1024
/** Logos, icons and badges stay as they are: flat colour gains nothing. */
const SKIP = /(logo|icon|favicon|badge|sprite|avatar)/i

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

async function main() {
  console.log(`\n  Scanning ${path.relative(ROOT, UPLOADS)}  (${APPLY ? 'APPLY' : 'dry run'})\n`)

  let scanned = 0
  let before = 0
  let after = 0
  const converted: { from: string; to: string; saved: number }[] = []

  for await (const file of walk(UPLOADS)) {
    if (!/\.png$/i.test(file)) continue
    scanned += 1
    if (SKIP.test(path.basename(file))) continue

    const size = (await stat(file)).size
    if (size < MIN_BYTES) continue

    const buffer = await sharp(file).webp({ quality: 82 }).toBuffer()
    if (buffer.byteLength >= size) continue

    const webpPath = file.replace(/\.png$/i, '.webp')
    const publicOld = `/uploads/${path.relative(UPLOADS, file).split(path.sep).join('/')}`
    const publicNew = `/uploads/${path.relative(UPLOADS, webpPath).split(path.sep).join('/')}`

    before += size
    after += buffer.byteLength
    converted.push({ from: publicOld, to: publicNew, saved: size - buffer.byteLength })

    if (!APPLY) continue

    await writeFile(webpPath, buffer)
    const meta = await sharp(buffer).metadata()

    await prisma.media
      .update({
        where: { path: publicOld },
        data: {
          path: publicNew,
          filename: path.basename(webpPath),
          mimeType: 'image/webp',
          bytes: buffer.byteLength,
          width: meta.width ?? null,
          height: meta.height ?? null,
        },
      })
      .catch(() => undefined)

    await unlink(file)
  }

  // Block props embed image paths as JSON, so they need repointing too.
  if (APPLY && converted.length) {
    const blocks = await prisma.pageBlock.findMany({ select: { id: true, props: true } })
    let touched = 0
    for (const block of blocks) {
      let json = JSON.stringify(block.props)
      let changed = false
      for (const { from, to } of converted) {
        if (json.includes(from)) {
          json = json.split(from).join(to)
          changed = true
        }
      }
      if (!changed) continue
      await prisma.pageBlock.update({ where: { id: block.id }, data: { props: JSON.parse(json) as object } })
      touched += 1
    }
    console.log(`  blocks repointed : ${touched}`)
  }

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`
  console.log(`  PNGs scanned     : ${scanned}`)
  console.log(`  would convert    : ${converted.length}`)
  console.log(`  before / after   : ${mb(before)} -> ${mb(after)}`)
  console.log(`  saved            : ${mb(before - after)}`)
  if (!APPLY) console.log('\n  Dry run. Re-run with --apply to write the files and update the database.\n')
  else console.log('\n  Done. Clear .next/cache so optimised variants regenerate.\n')

  await prisma.$disconnect()
}

await main()
