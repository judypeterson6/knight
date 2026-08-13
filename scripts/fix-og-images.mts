/**
 * Repairs the image references that structured data and social cards depend on.
 *
 *   npx tsx scripts/fix-og-images.mts
 *
 * Three separate breakages, all pointing at files that are not on disk:
 *
 *   1. Both defaultOgImage settings name a .png that image optimisation
 *      converted to .webp and deleted. Every page that falls back to the site
 *      default was therefore serving a 404 as its og:image, and the
 *      Organization and LocalBusiness nodes carried the same dead URL.
 *   2. Five guide posts carry an absolute https://knightscoaches.com/wp-content/
 *      URL left over from WordPress. That path does not exist on this site at
 *      all, so the article card image 404s for every one of them.
 *   3. A few page-level og images name a .png with the same .webp problem.
 *
 * Resolution order for each broken reference: the same name with a different
 * extension, then the post's own featured image, then nothing — which lets the
 * site default apply rather than pinning a wrong picture. Nothing is invented
 * and no reference is left pointing at a file that is absent.
 */

import { existsSync } from 'node:fs'
import { withDb } from './_db.mts'

const EXTS = ['webp', 'jpg', 'jpeg', 'png', 'avif']

/** Strips a WordPress origin and wp-content prefix down to a site-relative path. */
function toLocal(raw: string): string {
  let p = raw.trim()
  p = p.replace(/^https?:\/\/[^/]+/i, '')
  p = p.replace(/^\/wp-content\/uploads\//i, '/uploads/')
  return p
}

/** The same basename under any extension that is actually present. */
function resolve(raw: string): string | null {
  const local = toLocal(raw)
  if (!local.startsWith('/')) return null
  if (existsSync(`public${local}`)) return local
  const stem = local.replace(/\.[a-z0-9]+$/i, '')
  for (const ext of EXTS) {
    if (existsSync(`public${stem}.${ext}`)) return `${stem}.${ext}`
  }
  return null
}

await withDb(async (prisma) => {
  // ------------------------------------------------------------ settings ---
  console.log('\n  settings:')
  for (const key of ['branding', 'seo']) {
    const row = await prisma.setting.findUnique({ where: { key } })
    if (!row) continue
    const value = row.value as Record<string, unknown>
    const current = String(value.defaultOgImage ?? '')
    if (!current) continue

    if (existsSync(`public${current}`)) {
      console.log(`   ${key}.defaultOgImage already resolves`)
      continue
    }
    const fixed = resolve(current)
    if (!fixed) {
      console.log(`   ${key}.defaultOgImage UNRESOLVED: ${current}`)
      continue
    }
    await prisma.setting.update({ where: { key }, data: { value: { ...value, defaultOgImage: fixed } } })
    console.log(`   ${key}.defaultOgImage  ${current}\n${' '.repeat(21)}-> ${fixed}`)
  }

  // ------------------------------------------------------------- seoMeta ---
  const rows = await prisma.seoMeta.findMany({ where: { NOT: { ogImage: null } } })

  // Featured images, used as the second choice for a post.
  const posts = await prisma.post.findMany({
    select: { id: true, slug: true, featuredImage: { select: { path: true } } },
  })
  const featuredByPost = new Map(posts.map((p) => [p.id, p.featuredImage?.path ?? null]))

  let fixed = 0
  let cleared = 0
  let ok = 0

  console.log('\n  seoMeta.ogImage:')
  for (const row of rows) {
    const current = row.ogImage!
    if (existsSync(`public${current}`)) {
      ok += 1
      continue
    }

    let next = resolve(current)
    if (!next && row.entityType === 'POST') {
      const featured = featuredByPost.get(row.entityId)
      if (featured && existsSync(`public${featured}`)) next = featured
    }

    await prisma.seoMeta.update({ where: { id: row.id }, data: { ogImage: next } })
    if (next) {
      fixed += 1
      console.log(`   fixed   ${current.slice(-64)}\n            -> ${next}`)
    } else {
      cleared += 1
      console.log(`   cleared ${current.slice(-64)}  (falls back to the site default)`)
    }
  }

  console.log(`\n  ${ok} already resolved, ${fixed} repointed, ${cleared} cleared to the site default\n`)
})
