/**
 * Applies operator-supplied settings that cannot live in DEFAULTS.
 *
 *   npx tsx scripts/apply-site-settings.mts
 *
 * The seed writes settings with `update: {}` so an editor's own values survive
 * a re-seed. That also means DEFAULTS never reach an installed site, so real
 * credentials and verification tokens have to be written directly.
 *
 * The SMTP password is a live credential. It is read from the environment
 * rather than committed here, so this file stays safe to keep in git:
 *
 *   SMTP_PASSWORD="..." npx tsx scripts/apply-site-settings.mts
 *
 * Every value is merged over what is already stored, so nothing else in either
 * settings group is disturbed.
 */

import { createClient } from './_db.mts'

const prisma = createClient()

const GOOGLE_VERIFICATION = 'yHpmNm3hQ6_qpJgHbv5tlLQZT0A5XeCloRo7KfAGNxk'

const MAIL = {
  host: 'smtp.hostinger.com',
  // 587 with STARTTLS rather than the 465 implicit-TLS port that was asked for.
  // Hostinger's 465 listener does not send its intermediate certificate, so
  // Node rejects the chain with "unable to verify the first certificate".
  // 587 presents a complete chain and authenticates, verified against the live
  // mailbox. Both are encrypted; this is the one that validates, and the
  // alternative would have been to switch certificate checking off.
  port: 587,
  secure: false,
  user: 'info@knightscoaches.com',
  fromName: 'Knights Coaches',
  fromEmail: 'info@knightscoaches.com',
  notifyTo: 'info@knightscoaches.com',
}

async function patch(key: string, values: Record<string, unknown>) {
  const row = await prisma.setting.findUnique({ where: { key } })
  const current = (row?.value as Record<string, unknown>) ?? {}
  const next = { ...current, ...values }
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: next as object },
    update: { value: next as object },
  })
  return Object.keys(values)
}

const seoKeys = await patch('seo', { googleVerification: GOOGLE_VERIFICATION })
console.log(`\n  seo   : ${seoKeys.join(', ')} set`)

const password = process.env.SMTP_PASSWORD
const mailValues: Record<string, unknown> = { ...MAIL }
if (password) mailValues.password = password

const mailKeys = await patch('mail', mailValues)
console.log(`  mail  : ${mailKeys.filter((k) => k !== 'password').join(', ')} set`)
console.log(
  password
    ? '  mail  : password set from SMTP_PASSWORD'
    : '  mail  : password NOT set. Re-run with SMTP_PASSWORD=... or enter it in /admin/mail.',
)
console.log('\n  Clear .next/cache or save any setting from /admin to flush the cached values.\n')

await prisma.$disconnect()
