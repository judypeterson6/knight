/**
 * Raises the four theme colours that failed WCAG AA contrast.
 *
 *   npx tsx scripts/fix-contrast-tokens.mts
 *
 * The seed writes settings with `update: {}` so an admin's own theme survives a
 * re-seed. That also means changing DEFAULTS never reaches an installed site,
 * which is why these have to be patched directly.
 *
 * Only the four failing keys are touched. Every other token in the row is left
 * exactly as it is, so any customisation an editor has made survives.
 *
 * Measured against #ffffff surface and #faf8f5 surface-alt:
 *
 *   primary      #eb6e2c  3.09  ->  #bf5218  4.73   (white text on it, and as text)
 *   primaryHover #d85f1e  3.55  ->  #a8460f  5.92
 *   muted        #7a746c  4.36  ->  #5f5a53  6.44   (on surface-alt, the worse case)
 *   subtle       #9a938a  2.87  ->  #6b655c  5.44
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const FIXES: Record<string, { from: string; to: string }> = {
  primary: { from: '#eb6e2c', to: '#bf5218' },
  primaryHover: { from: '#d85f1e', to: '#a8460f' },
  muted: { from: '#7a746c', to: '#5f5a53' },
  subtle: { from: '#9a938a', to: '#6b655c' },
}

const row = await prisma.setting.findUnique({ where: { key: 'theme' } })
if (!row) {
  console.log('\n  No stored theme row; DEFAULTS already apply. Nothing to do.\n')
} else {
  const theme = row.value as Record<string, string>
  const next = { ...theme }
  const changed: string[] = []
  const skipped: string[] = []

  for (const [key, { from, to }] of Object.entries(FIXES)) {
    const current = theme[key]
    if (current === to) continue
    if (current !== from) {
      // Someone has picked their own colour here. Leave it and say so rather
      // than overwriting a deliberate choice.
      skipped.push(`${key} is ${current}, not the shipped ${from}`)
      continue
    }
    next[key] = to
    changed.push(`${key}  ${from} -> ${to}`)
  }

  if (changed.length) {
    await prisma.setting.update({ where: { key: 'theme' }, data: { value: next } })
  }

  console.log('\n  Theme contrast patch\n')
  for (const c of changed) console.log(`  updated : ${c}`)
  for (const s of skipped) console.log(`  skipped : ${s}`)
  if (!changed.length && !skipped.length) console.log('  already up to date')
  console.log('\n  Clear .next/cache or save any setting from /admin to flush the cached theme.\n')
}

await prisma.$disconnect()
