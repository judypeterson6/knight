/**
 * Trims stored meta descriptions to the tightened 150 character limit and
 * repoints redirects at /guides.
 *
 *   npx tsx scripts/reclamp-meta.mts
 *
 * The admin already rejects anything longer, but rows written under the old
 * 160 limit are still in the database and would block an editor saving an
 * unrelated field on those pages.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TITLE_MAX = 60
const DESCRIPTION_MAX = 150

/** Cuts on a word boundary, with no ellipsis: the SERP adds its own. */
function clamp(value: string | null, max: number): string | null {
  if (!value) return value
  const text = value.trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-–—]+$/, '')
}

const rows = await prisma.seoMeta.findMany({ select: { id: true, title: true, description: true } })
let touched = 0
for (const row of rows) {
  const title = clamp(row.title, TITLE_MAX)
  const description = clamp(row.description, DESCRIPTION_MAX)
  if (title === row.title && description === row.description) continue
  await prisma.seoMeta.update({ where: { id: row.id }, data: { title, description } })
  touched += 1
}
console.log(`\n  seo rows re-clamped : ${touched} of ${rows.length}`)

const over = await prisma.seoMeta.findMany({ select: { title: true, description: true } })
console.log(`  titles over ${TITLE_MAX}      : ${over.filter((r) => (r.title ?? '').length > TITLE_MAX).length}`)
console.log(`  descriptions over ${DESCRIPTION_MAX} : ${over.filter((r) => (r.description ?? '').length > DESCRIPTION_MAX).length}`)

// Redirects: the snapshot is the source of truth and now points at /guides.
interface RedirectRecord {
  from: string
  to: string
  kind: 'PERMANENT' | 'TEMPORARY'
  note: string
}
const file = path.join(process.cwd(), 'prisma', 'seed-data', 'redirects.json')
const redirects = JSON.parse(readFileSync(file, 'utf8')) as RedirectRecord[]

// Drop the stale /guides -> /blog rows before writing the reversed ones, or the
// pair would bounce a request between the two paths forever.
const stale = await prisma.redirect.deleteMany({ where: { to: { startsWith: '/blog' } } })

for (const r of redirects) {
  await prisma.redirect.upsert({
    where: { from: r.from },
    create: { from: r.from, to: r.to, kind: r.kind, note: r.note },
    update: { to: r.to, kind: r.kind, note: r.note },
  })
}
console.log(`\n  stale /blog targets removed : ${stale.count}`)
console.log(`  redirects written           : ${redirects.length}\n`)

await prisma.$disconnect()
