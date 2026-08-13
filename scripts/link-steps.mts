/**
 * Gives each booking step somewhere to go, and reports internal links that
 * resolve to nothing.
 *
 *   npx tsx scripts/link-steps.mts
 *
 * The four-step section was static text. Each step now carries the URL where
 * that step actually happens, so the section is a route through the site rather
 * than a description of one. Steps are matched on their own wording, and a step
 * whose wording is not recognised is left alone rather than pointed at a guess.
 *
 * The second half walks every internal href stored in a block, a post body or a
 * menu row, and checks it against the pages, posts, coaches and redirects that
 * exist. It only reports; nothing is rewritten, because the fix for a dead link
 * is usually the destination, not the link.
 */

import { withDb } from './_db.mts'

const DESTINATIONS: [RegExp, string, string][] = [
  [/select|choose|your (bus|coach)/i, '/fleet', 'Browse the fleet'],
  [/confirm|quote|booking and/i, '/reservation#booking-form', 'Send a reservation request'],
  [/payment|deposit|contract/i, '/reservation', 'Start a reservation'],
  [/road trip|departure|start your|travel day/i, '/contact-us', 'Talk to dispatch'],
]

await withDb(async (prisma) => {
  // ------------------------------------------------------------- steps ---
  const blocks = await prisma.pageBlock.findMany({
    where: { type: 'StepsHowItWorks' },
    include: { page: { select: { path: true } } },
  })

  let linked = 0
  let unmatched = 0

  for (const block of blocks) {
    const props = block.props as Record<string, unknown>
    const items = (props.items ?? []) as { title?: string; url?: string; linkLabel?: string }[]
    if (!Array.isArray(items) || !items.length) continue

    let changed = false
    const next = items.map((item) => {
      if (item.url) return item
      const hit = DESTINATIONS.find(([rx]) => rx.test(String(item.title ?? '')))
      if (!hit) {
        unmatched += 1
        return { ...item, url: '', linkLabel: '' }
      }
      changed = true
      linked += 1
      return { ...item, url: hit[1], linkLabel: hit[2] }
    })

    if (changed) {
      await prisma.pageBlock.update({ where: { id: block.id }, data: { props: { ...props, items: next } } })
    }
  }

  console.log(`\n  steps: ${linked} linked across ${blocks.length} blocks, ${unmatched} left without a link`)

  // ------------------------------------------------------------- links ---
  const [pages, posts, coaches, redirects, menus] = await Promise.all([
    prisma.page.findMany({ select: { path: true, status: true } }),
    prisma.post.findMany({ select: { slug: true, status: true, body: true } }),
    prisma.coach.findMany({ select: { slug: true, status: true } }),
    prisma.redirect.findMany({ where: { enabled: true }, select: { from: true } }),
    prisma.menuItem.findMany({ select: { label: true, url: true, menu: { select: { slug: true } } } }),
  ])

  const known = new Set<string>([
    ...pages.filter((p) => p.status === 'PUBLISHED').map((p) => p.path),
    ...posts.filter((p) => p.status === 'PUBLISHED').map((p) => `/guides/${p.slug}`),
    ...coaches.filter((c) => c.status === 'PUBLISHED').map((c) => `/fleet/${c.slug}`),
    ...redirects.map((r) => r.from),
    // Real routes that are files rather than rows.
    '/', '/guides', '/fleet', '/sitemap', '/sitemap.xml', '/privacy-policy', '/terms',
  ])

  const bad = new Map<string, Set<string>>()
  const note = (url: string, where: string) => {
    if (!bad.has(url)) bad.set(url, new Set())
    bad.get(url)!.add(where)
  }

  /** Internal, navigable hrefs only. */
  const check = (raw: string, where: string) => {
    if (!raw || /^(https?:|mailto:|tel:|#)/i.test(raw)) return
    if (!raw.startsWith('/')) return
    const path = raw.split(/[?#]/)[0].replace(/\/$/, '') || '/'
    if (/\.(png|jpe?g|webp|avif|svg|pdf|xml|txt|ico|mp4|webm)$/i.test(path)) return
    if (!known.has(path)) note(path, where)
  }

  const allBlocks = await prisma.pageBlock.findMany({ include: { page: { select: { path: true } } } })
  for (const b of allBlocks) {
    const json = JSON.stringify(b.props)
    for (const m of json.matchAll(/"(?:url|href)"\s*:\s*"([^"]*)"/g)) {
      check(m[1], `${b.page?.path ?? '?'} (${b.type})`)
    }
    for (const m of json.matchAll(/href=\\"([^"\\]*)\\"/g)) check(m[1], `${b.page?.path ?? '?'} (${b.type})`)
  }
  for (const p of posts) for (const m of p.body.matchAll(/href="([^"]*)"/g)) check(m[1], `/guides/${p.slug}`)
  for (const mi of menus) check(mi.url, `${mi.menu.slug} menu ("${mi.label}")`)

  if (!bad.size) {
    console.log('  links: every internal link resolves\n')
    return
  }

  console.log(`\n  links: ${bad.size} internal targets do not resolve`)
  for (const [url, where] of [...bad].sort()) {
    const list = [...where]
    console.log(`   ${url.padEnd(42)} ${list.length} place(s)  e.g. ${list[0]}`)
  }
  console.log('')
})
