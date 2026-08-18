/**
 * Restores the Fleet nav link and settles the header actions.
 *
 *   npx tsx scripts/fix-header-menu.mts
 *
 * Adding the header CTAs matched an existing row by url, and "/fleet" was
 * already the Fleet nav link. So instead of creating a button it renamed that
 * link to "Rent a bus" and flipped it to a CTA, which took Fleet out of the
 * navigation entirely.
 *
 * This puts Fleet back where it was and points both actions at the reservation
 * page, so neither of them takes a destination the nav already needs.
 */

import { withDb } from './_db.mts'

await withDb(async (prisma) => {
  const menu = await prisma.menu.findUnique({ where: { slug: 'header' }, include: { items: true } })
  if (!menu) throw new Error('header menu is missing')

  // The row that used to be Fleet, identified by the destination it kept.
  const hijacked = menu.items.find((i) => i.url === '/fleet' && i.isCta)
  if (hijacked) {
    await prisma.menuItem.update({
      where: { id: hijacked.id },
      data: { label: 'Fleet', url: '/fleet', isCta: false, order: 2 },
    })
    console.log('  restored "Fleet" to the navigation')
  } else if (!menu.items.some((i) => i.url === '/fleet' && !i.isCta)) {
    await prisma.menuItem.create({
      data: { menuId: menu.id, kind: 'CUSTOM', label: 'Fleet', url: '/fleet', order: 2, visible: true },
    })
    console.log('  added "Fleet" to the navigation')
  } else {
    console.log('  "Fleet" already in the navigation')
  }

  // Both actions lead to the reservation page: the button to the page, the
  // secondary link straight to the form on it.
  const actions = [
    { label: 'Rent a bus', url: '/reservation', order: 20 },
    { label: 'Online reservation', url: '/reservation#booking-form', order: 21 },
  ]

  // Re-read: the restore above changed a row that `menu.items` still describes
  // as the "Rent a bus" CTA, and matching against that stale copy would hand
  // the freshly restored Fleet link straight back to the action loop.
  const current = await prisma.menuItem.findMany({ where: { menuId: menu.id } })

  for (const action of actions) {
    const existing = current.find((i) => i.isCta && i.label === action.label)
    if (existing) {
      await prisma.menuItem.update({ where: { id: existing.id }, data: { ...action, isCta: true, visible: true } })
    } else {
      await prisma.menuItem.create({
        data: { menuId: menu.id, kind: 'CUSTOM', ...action, isCta: true, visible: true },
      })
    }
  }

  // Eight links plus two buttons plus the phone cannot fit the 1360px bar, and
  // the overflow was pushing labels onto two lines. Rather than shrink type
  // until it fits, two links that duplicate something else come out: the logo
  // already goes home, and Nationwide is a child of Tour Bus Rental. Both are
  // still in the footer, so nothing becomes unreachable.
  const REDUNDANT = ['/', '/tour-bus-rental/nationwide']
  const dropped = await prisma.menuItem.findMany({
    where: { menuId: menu.id, isCta: false, url: { in: REDUNDANT } },
  })
  if (dropped.length) {
    const footer = await prisma.menu.findUnique({ where: { slug: 'footer' }, include: { items: true } })
    const stillReachable = dropped.every((d) => footer?.items.some((f) => f.url === d.url))
    if (!stillReachable) throw new Error('refusing to drop a header link the footer does not carry')
    await prisma.menuItem.deleteMany({ where: { id: { in: dropped.map((d) => d.id) } } })
    console.log(`  removed from the nav: ${dropped.map((d) => d.label).join(', ')} (both remain in the footer)`)
  }

  const after = await prisma.menuItem.findMany({ where: { menuId: menu.id }, orderBy: { order: 'asc' } })
  console.log('\n  header menu:')
  for (const i of after) console.log(`   ${i.isCta ? 'button' : '  link'}  ${i.label.padEnd(20)} ${i.url}`)
  console.log(`\n  ${after.filter((i) => !i.isCta).length} nav links, ${after.filter((i) => i.isCta).length} actions\n`)
})
