/**
 * Pre-seed smoke test.  Run: npm run verify
 *
 * Checks everything that does NOT need a database, so a broken block schema or
 * a bad migration snapshot is caught before `prisma db seed` touches MySQL:
 *
 *   1. every block type parses its own defaults
 *   2. the migration snapshot exists and has the shape prisma/seed.ts expects
 *   3. every image path referenced by the snapshot exists on disk
 *   4. every redirect target resolves to a migrated route or a known static one
 *   5. no redirect points at itself or forms a two-step loop
 *
 * Exits non-zero on failure so it can gate a deploy.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BLOCK_TYPES, blockSchemas, requireAlt } from '../src/lib/blocks/schema'
import {
  BESPOKE_ROUTES,
  LEGAL_PAGES,
  buildAboutBlocks,
  buildContactBlocks,
  buildContext,
  buildFleetBlocks,
  buildGenericBlocks,
  buildHomeBlocks,
  buildLegalBlocks,
  type LocationRecord as LocationSeed,
  type MediaRecord as MediaSeed,
  type PageRecord as PageSeed,
  type SeedBlock,
} from '../prisma/seed-blocks'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'prisma', 'seed-data')

const failures: string[] = []
const warnings: string[] = []

function check(condition: boolean, message: string): void {
  if (!condition) failures.push(message)
}

function read<T>(file: string): T | null {
  const full = path.join(DATA, file)
  if (!existsSync(full)) {
    failures.push(`Missing snapshot file: prisma/seed-data/${file}. Run "npm run migrate:wp".`)
    return null
  }
  try {
    return JSON.parse(readFileSync(full, 'utf8')) as T
  } catch (error) {
    failures.push(`prisma/seed-data/${file} is not valid JSON: ${(error as Error).message}`)
    return null
  }
}

console.log('\n  Verifying content and block schemas\n')

// --- 1. Block schemas -------------------------------------------------------
for (const type of BLOCK_TYPES) {
  try {
    const defaults = blockSchemas[type].parse({})
    check(typeof defaults === 'object' && defaults !== null, `${type}: defaults did not parse to an object`)
  } catch (error) {
    failures.push(`Block "${type}" cannot parse its own defaults: ${(error as Error).message}`)
  }
}
console.log(`  block schemas       ${BLOCK_TYPES.length} parsed`)

// --- 2. Snapshot shape ------------------------------------------------------
interface PageRecord {
  route: string
  slug: string
  title: string
  pageType: string
  outline: { tag: string; text: string; items?: string[] }[]
  images: string[]
  seo: { title: string | null; description: string | null; robots: string }
}
interface MediaRecord {
  path: string
  alt: string
  width: number | null
  height: number | null
}
interface RedirectRecord {
  from: string
  to: string
}
interface CoachRecord {
  slug: string
  name: string
  bunks: number
  images: string[]
}
interface PostRecord {
  slug: string
  title: string
  body: string
}

const pages = read<PageRecord[]>('pages.json') ?? []
const media = read<MediaRecord[]>('media.json') ?? []
const redirects = read<RedirectRecord[]>('redirects.json') ?? []
const coaches = read<CoachRecord[]>('coaches.json') ?? []
const posts = read<PostRecord[]>('posts.json') ?? []
const locations = read<LocationSeed[]>('locations.json') ?? []

check(pages.length > 0, 'pages.json is empty — the migration found nothing.')
check(media.length > 0, 'media.json is empty.')

for (const page of pages) {
  check(page.route.startsWith('/'), `Page route "${page.route}" must start with a slash.`)
  check(page.route === '/' || !page.route.endsWith('/'), `Page route "${page.route}" must not end with a slash.`)
  check(Boolean(page.title.trim()), `Page ${page.route} has no title.`)
  check(Array.isArray(page.outline), `Page ${page.route} has no outline array.`)
  if (!page.seo.description) warnings.push(`Page ${page.route} has no migrated meta description.`)
}
console.log(`  pages               ${pages.length} checked`)

// --- 3. Media on disk -------------------------------------------------------
const mediaPaths = new Set(media.map((m) => m.path))
let missingFiles = 0
let missingAlt = 0

for (const asset of media) {
  const onDisk = path.join(ROOT, 'public', asset.path.replace(/^\//, ''))
  if (!existsSync(onDisk)) {
    missingFiles += 1
    if (missingFiles <= 5) failures.push(`Media file missing on disk: ${asset.path}`)
  }
  if (!asset.alt.trim()) missingAlt += 1
}
if (missingFiles > 5) failures.push(`…and ${missingFiles - 5} more media files missing on disk.`)

console.log(`  media               ${media.length} records, ${missingFiles} missing on disk`)
if (missingAlt) {
  warnings.push(
    `${missingAlt} of ${media.length} assets have no alt text. They are listed in the admin SEO audit and cannot be added to a coach gallery until labelled.`,
  )
}

// Images referenced by pages and coaches must be known media.
for (const page of pages) {
  for (const image of page.images) {
    if (image.startsWith('/uploads/') && !mediaPaths.has(image)) {
      warnings.push(`Page ${page.route} references ${image}, which is not in media.json.`)
    }
  }
}
for (const coach of coaches) {
  for (const image of coach.images) {
    if (image.startsWith('/uploads/') && !mediaPaths.has(image)) {
      failures.push(`Coach "${coach.name}" references ${image}, which is not in media.json.`)
    }
  }
  check(coach.bunks > 0, `Coach "${coach.name}" has a bunk count of ${coach.bunks}.`)
}
console.log(`  coaches             ${coaches.length} checked`)
console.log(`  posts               ${posts.length} checked`)

// --- 4 & 5. Redirect integrity ---------------------------------------------
const knownRoutes = new Set<string>([
  ...pages.map((p) => p.route),
  ...coaches.map((c) => `/fleet/${c.slug}`),
  ...posts.map((p) => `/guides/${p.slug}`),
  '/guides',
  '/sitemap',
  '/privacy-policy',
  '/terms',
  '/disclaimer',
])

const redirectMap = new Map(redirects.map((r) => [r.from, r.to]))

for (const redirect of redirects) {
  check(redirect.from !== redirect.to, `Redirect ${redirect.from} points at itself.`)

  if (redirect.to.startsWith('/') && !knownRoutes.has(redirect.to)) {
    // A chain is allowed only if it terminates at a known route.
    const next = redirectMap.get(redirect.to)
    if (!next) {
      failures.push(`Redirect ${redirect.from} -> ${redirect.to} targets a route that does not exist.`)
    } else if (next === redirect.from) {
      failures.push(`Redirect loop: ${redirect.from} <-> ${redirect.to}.`)
    } else {
      warnings.push(`Redirect chain: ${redirect.from} -> ${redirect.to} -> ${next}. Point the first one straight at the end.`)
    }
  }
}
console.log(`  redirects           ${redirects.length} checked`)

// --- 6. Page composition ----------------------------------------------------
//
// Runs every builder the seed will run, against the real snapshot, and checks
// each block it produces. This is the part that would otherwise only be
// exercised the first time `prisma db seed` touches a live database.
if (pages.length && media.length) {
  const ctx = buildContext(pages as PageSeed[], locations as LocationSeed[], media as MediaSeed[])

  const built: { label: string; blocks: SeedBlock[] }[] = []

  const run = (label: string, fn: () => SeedBlock[]): void => {
    try {
      built.push({ label, blocks: fn() })
    } catch (error) {
      failures.push(`Page composition failed for ${label}: ${(error as Error).message}`)
    }
  }

  run('/', () => buildHomeBlocks(ctx))
  run('/fleet', () => buildFleetBlocks(ctx))
  run('/contact-us', () => buildContactBlocks(ctx))
  run('/about-us', () => buildAboutBlocks(ctx))
  for (const legal of LEGAL_PAGES) run(legal.route, () => buildLegalBlocks(legal, ctx))
  for (const page of pages as PageSeed[]) {
    if (BESPOKE_ROUTES.has(page.route)) continue
    run(page.route, () => buildGenericBlocks(page, ctx))
  }

  let blockCount = 0
  const linkTargets = new Set<string>()

  for (const { label, blocks } of built) {
    check(blocks.length > 0, `${label} composed zero blocks.`)

    const h1s = blocks.filter(
      (b) => (b.props as { headingLevel?: string }).headingLevel === 'h1' && (b.props as { heading?: string }).heading,
    )
    check(h1s.length === 1, `${label} has ${h1s.length} h1 blocks — every page must have exactly one.`)

    for (const [index, b] of blocks.entries()) {
      blockCount += 1

      // Re-parse: catches a builder emitting props the schema would reject.
      const parsed = blockSchemas[b.type].safeParse(b.props)
      if (!parsed.success) {
        failures.push(`${label} block ${index + 1} (${b.type}): ${parsed.error.errors[0]?.message ?? 'invalid'}`)
        continue
      }

      // Same alt-text gate the block API enforces on save.
      const altErrors = requireAlt(parsed.data, `${label}[${index}]`)
      for (const error of altErrors) failures.push(error)

      // Collect internal link targets so dead CTAs are caught before publish.
      collectUrls(parsed.data, linkTargets)
    }
  }

  const knownForLinks = new Set(knownRoutes)
  for (const target of linkTargets) {
    if (!target.startsWith('/')) continue
    const clean = target.split('#')[0].split('?')[0].replace(/\/$/, '') || '/'
    if (clean === '#') continue
    if (!knownForLinks.has(clean)) {
      failures.push(`A seeded block links to ${target}, which is not a route this seed creates.`)
    }
  }

  console.log(`  page templates      ${built.length} composed, ${blockCount} blocks validated`)
  console.log(`  internal links      ${linkTargets.size} distinct targets checked`)
}

function collectUrls(node: unknown, into: Set<string>): void {
  if (Array.isArray(node)) {
    for (const child of node) collectUrls(child, into)
    return
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (typeof value === 'string' && key === 'url' && value.trim()) into.add(value.trim())
      else collectUrls(value, into)
    }
  }
}

// --- Report -----------------------------------------------------------------
const line = '  ' + '-'.repeat(66)
console.log(`\n${line}`)

if (warnings.length) {
  console.log(`  WARNINGS (${warnings.length}):`)
  for (const warning of warnings.slice(0, 15)) console.log(`    ${warning}`)
  if (warnings.length > 15) console.log(`    …and ${warnings.length - 15} more.`)
  console.log(line)
}

if (failures.length) {
  console.log(`  FAILURES (${failures.length}):`)
  for (const failure of failures.slice(0, 25)) console.log(`    ${failure}`)
  if (failures.length > 25) console.log(`    …and ${failures.length - 25} more.`)
  console.log(line)
  console.log('\n  Verification failed.\n')
  process.exit(1)
}

console.log('  All checks passed.')
console.log(`${line}\n`)
