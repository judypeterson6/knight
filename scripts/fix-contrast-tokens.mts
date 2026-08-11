/**
 * Brings the stored theme in line with the shipped tokens.
 *
 *   npx tsx scripts/fix-contrast-tokens.mts
 *
 * The seed writes settings with `update: {}` so an editor's own theme survives
 * a re-seed. That also means changing DEFAULTS never reaches an installed
 * site, which is why these have to be patched directly.
 *
 * The brand orange stays #eb6e2c. It clears the 3:1 bar that applies to large
 * text and to non-text UI, which is what it is actually used for: panel fills,
 * icons, borders and display numerals. It does not clear the 4.5:1 bar for
 * small text, so primaryDeep exists for that and nothing else. Darkening the
 * brand colour itself was the first attempt and it turned every orange panel
 * on the site muddy.
 *
 * Measured on #ffffff:
 *   primary      #eb6e2c  3.09  fills, icons, large text
 *   primaryDeep  #a8460f  5.92  links, eyebrows, labels, badges
 *   muted        #5f5a53  6.83  body copy
 *   subtle       #6b655c  5.77  helper text
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/** Target value, and the values it is safe to overwrite. */
const FIXES: Record<string, { to: string; from: string[] }> = {
  primary: { to: '#eb6e2c', from: ['#bf5218'] },
  primaryHover: { to: '#d85f1e', from: ['#a8460f'] },
  primaryDeep: { to: '#a8460f', from: [] },
  muted: { to: '#5f5a53', from: ['#7a746c'] },
  subtle: { to: '#6b655c', from: ['#9a938a'] },
}

const row = await prisma.setting.findUnique({ where: { key: 'theme' } })
if (!row) {
  console.log('\n  No stored theme row; DEFAULTS already apply.\n')
} else {
  const theme = row.value as Record<string, string>
  const next = { ...theme }
  const changed: string[] = []
  const skipped: string[] = []

  for (const [key, { to, from }] of Object.entries(FIXES)) {
    const current = theme[key]
    if (current === to) continue
    // A key that has never existed is added; one holding a value we shipped is
    // corrected; anything else is a deliberate choice and is left alone.
    if (current !== undefined && !from.includes(current)) {
      skipped.push(`${key} is ${current}, not a value we shipped`)
      continue
    }
    next[key] = to
    changed.push(`${key.padEnd(13)} ${current ?? '(absent)'} -> ${to}`)
  }

  if (changed.length) await prisma.setting.update({ where: { key: 'theme' }, data: { value: next } })

  console.log('\n  Theme tokens\n')
  for (const c of changed) console.log(`  updated : ${c}`)
  for (const s of skipped) console.log(`  skipped : ${s}`)
  if (!changed.length && !skipped.length) console.log('  already up to date')
  console.log('\n  Clear .next/cache or save any setting from /admin to flush the cached theme.\n')
}

await prisma.$disconnect()
