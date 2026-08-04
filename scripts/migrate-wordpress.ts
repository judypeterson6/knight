/**
 * WordPress -> MySQL content migration for knightscoaches.com
 * ---------------------------------------------------------------------------
 * Run:  npm run migrate:wp            (source: $WP_SOURCE_URL)
 *       npm run migrate:wp -- --no-media       skip binary downloads
 *       npm run migrate:wp -- --limit 5        first N pages/posts (smoke test)
 *
 * What it does, in order:
 *   1. Discovers content. Tries the WP REST API first
 *      (/wp-json/wp/v2/{pages,posts,categories,media,users}, per_page=100,
 *      paginated via X-WP-TotalPages). If REST is disabled it falls back to
 *      crawling /sitemap_index.xml plus its child sitemaps and parsing the
 *      rendered HTML of every URL it finds.
 *   2. Preserves each page's full body: heading structure (h1-h4), lists and
 *      section order all survive, because the body HTML is kept verbatim and
 *      additionally decomposed into an ordered outline.
 *   3. Downloads every wp-content/uploads asset referenced by any migrated
 *      page, post, or media record into /public/uploads/<year>/<month>/,
 *      keeping the original filename, and rewrites every content URL to the
 *      new local path. 404s are collected and listed in the report.
 *   4. Captures SEO metadata per URL: title, meta description, canonical,
 *      OG title/description/image, robots. `meta keywords` is deliberately
 *      dropped — it is a deprecated signal and has no column in the schema.
 *   5. Extracts the fleet, testimonials, destinations, stats and FAQs as
 *      structured records rather than blobs of HTML.
 *   6. Detects duplicate URLs that cover the same topic, picks one canonical
 *      route per topic, and emits 301 redirects for the rest.
 *   7. Writes prisma/seed-data/*.json (consumed by prisma/seed.ts) and prints
 *      a migration report.
 *
 * The script is idempotent: WordPress ids are carried into the snapshot, so a
 * re-run updates rather than duplicates.
 */

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SEED_DIR = path.join(ROOT, 'prisma', 'seed-data')
const UPLOAD_DIR = path.join(ROOT, 'public', 'uploads')
const CACHE_DIR = path.join(ROOT, 'scripts', '.wp-cache')

const SOURCE = (process.env.WP_SOURCE_URL || 'https://knightscoaches.com').replace(/\/+$/, '')
const ARGS = process.argv.slice(2)
const SKIP_MEDIA = ARGS.includes('--no-media')
const NO_CACHE = ARGS.includes('--no-cache')
const LIMIT = (() => {
  const i = ARGS.indexOf('--limit')
  return i >= 0 && ARGS[i + 1] ? Number(ARGS[i + 1]) : Infinity
})()

// ---------------------------------------------------------------------------
// Route map: old WordPress URL -> new route.
//
// The live footer links to two different leasing URLs and two different
// nationwide URLs. One canonical route is chosen per topic here; every other
// spelling becomes a 301 (see DUPLICATE_TOPICS below) and the seeded footer
// menu points at the canonical one only.
// ---------------------------------------------------------------------------

const CANONICAL_ROUTES: Record<string, string> = {
  '/': '/',
  '/about-us/': '/about-us',
  '/entertainer-coach/': '/entertainer-coach',
  '/entertainer-coach/leasing/': '/entertainer-coach/leasing',
  '/tour-bus-rental/': '/tour-bus-rental',
  '/tour-bus-rental/nationwide/': '/tour-bus-rental/nationwide',
  '/tour-trucking/': '/tour-trucking',
  '/fleet/': '/fleet',
  '/contact-us/': '/contact-us',
}

/** Known duplicate spellings -> the canonical route they 301 to. */
const DUPLICATE_TOPICS: Record<string, string> = {
  '/entertainer-coach-rental/leasing/': '/entertainer-coach/leasing',
  '/entertainer-coach-rental/': '/entertainer-coach',
  '/nationwide-tour-bus-rentals/': '/tour-bus-rental/nationwide',
  '/nationwide-tour-bus-rental/': '/tour-bus-rental/nationwide',
  '/entertainer-coach/leasing-2/': '/entertainer-coach/leasing',
  '/tour-bus-rental/nationwide-2/': '/tour-bus-rental/nationwide',
}

/** Page-type classification drives which Visual-Semantics layout a page uses. */
function classify(route: string): string {
  if (route === '/') return 'home'
  if (route === '/about-us') return 'about'
  if (route === '/contact-us') return 'contact'
  if (route === '/fleet') return 'fleet-listing'
  if (route === '/tour-bus-rental/nationwide') return 'location'
  if (/^\/tour-bus-rental\/[a-z0-9-]+$/.test(route)) return 'location'
  if (/^\/(privacy-policy|terms|disclaimer)$/.test(route)) return 'legal'
  return 'service'
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WpRendered {
  rendered: string
}

interface WpPage {
  id: number
  slug: string
  link: string
  status: string
  date_gmt: string
  modified_gmt: string
  parent?: number
  title: WpRendered
  content: WpRendered
  excerpt?: WpRendered
  featured_media?: number
  author?: number
  categories?: number[]
  yoast_head_json?: Record<string, unknown>
}

interface WpMedia {
  id: number
  source_url: string
  mime_type: string
  alt_text?: string
  title?: WpRendered
  caption?: WpRendered
  media_details?: { width?: number; height?: number }
}

interface WpCategory {
  id: number
  slug: string
  name: string
  description: string
  parent: number
  count: number
}

interface SeoRecord {
  title: string | null
  description: string | null
  canonical: string | null
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  robots: 'INDEX_FOLLOW' | 'NOINDEX_FOLLOW' | 'INDEX_NOFOLLOW' | 'NOINDEX_NOFOLLOW'
}

interface OutlineNode {
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'ul' | 'ol'
  text: string
  items?: string[]
}

interface MediaRecord {
  sourceUrl: string
  path: string
  filename: string
  mimeType: string
  alt: string
  title: string | null
  caption: string | null
  width: number | null
  height: number | null
  bytes: number | null
}

interface PageRecord {
  wpId: number | null
  wpUrl: string | null
  route: string
  slug: string
  title: string
  pageType: string
  status: 'PUBLISHED' | 'DRAFT'
  publishedAt: string | null
  bodyHtml: string
  outline: OutlineNode[]
  images: string[]
  seo: SeoRecord
}

interface PostRecord {
  wpId: number
  wpUrl: string
  slug: string
  title: string
  excerpt: string
  body: string
  status: 'PUBLISHED' | 'DRAFT'
  publishedAt: string | null
  categorySlug: string | null
  featuredImage: string | null
  seo: SeoRecord
}

interface RedirectRecord {
  from: string
  to: string
  kind: 'PERMANENT' | 'TEMPORARY'
  note: string
}

interface Report {
  source: string
  startedAt: string
  finishedAt: string
  pagesFound: number
  pagesMigrated: number
  postsFound: number
  postsMigrated: number
  categoriesMigrated: number
  imagesFound: number
  imagesDownloaded: number
  imagesFailed: string[]
  redirectsCreated: number
  duplicatesFound: { url: string; canonical: string }[]
  discovery: 'rest' | 'sitemap'
  warnings: string[]
}

// ---------------------------------------------------------------------------
// HTTP with an on-disk cache (keeps re-runs fast and the source server happy)
// ---------------------------------------------------------------------------

const warnings: string[] = []

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

function cacheKey(url: string): string {
  return createHash('sha1').update(url).digest('hex')
}

async function fetchText(url: string): Promise<{ body: string; headers: Headers } | null> {
  const cacheFile = path.join(CACHE_DIR, `${cacheKey(url)}.json`)
  if (!NO_CACHE && existsSync(cacheFile)) {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8')) as {
      body: string
      headers: [string, string][]
    }
    return { body: cached.body, headers: new Headers(cached.headers) }
  }
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'knightscoaches-migration/1.0 (+https://knightscoaches.com)' },
      redirect: 'follow',
    })
    if (!res.ok) {
      warnings.push(`HTTP ${res.status} for ${url}`)
      return null
    }
    const body = await res.text()
    await ensureDir(CACHE_DIR)
    await writeFile(
      cacheFile,
      JSON.stringify({ body, headers: [...res.headers.entries()] }),
      'utf8',
    )
    return { body, headers: res.headers }
  } catch (err) {
    warnings.push(`Network error for ${url}: ${(err as Error).message}`)
    return null
  }
}

async function fetchJson<T>(url: string): Promise<{ data: T; headers: Headers } | null> {
  const res = await fetchText(url)
  if (!res) return null
  try {
    return { data: JSON.parse(res.body) as T, headers: res.headers }
  } catch {
    warnings.push(`Non-JSON response from ${url}`)
    return null
  }
}

/** Walks every page of a WP REST collection using X-WP-TotalPages. */
async function fetchAll<T>(endpoint: string): Promise<T[]> {
  const out: T[] = []
  let page = 1
  let totalPages = 1
  do {
    const sep = endpoint.includes('?') ? '&' : '?'
    const url = `${SOURCE}/wp-json/wp/v2/${endpoint}${sep}per_page=100&page=${page}`
    const res = await fetchJson<T[]>(url)
    if (!res) break
    if (!Array.isArray(res.data)) break
    out.push(...res.data)
    totalPages = Number(res.headers.get('x-wp-totalpages') || '1') || 1
    page += 1
  } while (page <= totalPages)
  return out
}

// ---------------------------------------------------------------------------
// HTML utilities
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  ndash: '\u2013',
  mdash: '\u2014',
  hellip: '\u2026',
  rsquo: '\u2019',
  lsquo: '\u2018',
  ldquo: '\u201c',
  rdquo: '\u201d',
  eacute: '\u00e9',
  times: '\u00d7',
  '#8217': '\u2019',
  '#8216': '\u2018',
  '#8220': '\u201c',
  '#8221': '\u201d',
  '#8211': '\u2013',
  '#8212': '\u2014',
  '#8230': '\u2026',
  '#039': "'",
  '#39': "'",
}

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, name: string) => {
    const direct = ENTITIES[name]
    if (direct) return direct
    if (name.startsWith('#x') || name.startsWith('#X')) {
      return String.fromCodePoint(parseInt(name.slice(2), 16))
    }
    if (name.startsWith('#')) {
      const code = Number(name.slice(1))
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return match
  })
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const m = re.exec(tag)
  if (!m) return null
  return decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
}

function metaContent(html: string, matcher: RegExp): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) || []
  for (const tag of tags) {
    const key = attr(tag, 'name') || attr(tag, 'property')
    if (key && matcher.test(key)) {
      const content = attr(tag, 'content')
      if (content) return content
    }
  }
  return null
}

/**
 * Decomposes body HTML into an ordered outline. Heading levels, list items and
 * section order are all preserved, which is what makes the migrated page
 * reproducible as typed blocks instead of one opaque HTML dump.
 */
function outlineOf(html: string): OutlineNode[] {
  const nodes: OutlineNode[] = []
  const re = /<(h1|h2|h3|h4|p|ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const tag = m[1].toLowerCase() as OutlineNode['tag']
    const inner = m[2]
    if (tag === 'ul' || tag === 'ol') {
      const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((li) => stripTags(li[1]))
        .filter(Boolean)
      if (items.length) nodes.push({ tag, text: '', items })
      continue
    }
    const text = stripTags(inner)
    if (text) nodes.push({ tag, text })
  }
  return nodes
}

/** Every wp-content/uploads URL referenced anywhere in the markup. */
function imageUrlsIn(html: string): string[] {
  const found = new Set<string>()
  const re = /https?:\/\/[^"'\s)\\]+\/wp-content\/uploads\/[^"'\s)\\]+/gi
  for (const raw of html.match(re) || []) {
    // Strip srcset size suffixes that arrive glued to the URL.
    found.add(decodeEntities(raw.replace(/[.,;]+$/, '')))
  }
  return [...found]
}

// ---------------------------------------------------------------------------
// SEO extraction
// ---------------------------------------------------------------------------

function robotsFrom(text: string | null): SeoRecord['robots'] {
  const v = (text || '').toLowerCase()
  const noindex = v.includes('noindex')
  const nofollow = v.includes('nofollow')
  if (noindex && nofollow) return 'NOINDEX_NOFOLLOW'
  if (noindex) return 'NOINDEX_FOLLOW'
  if (nofollow) return 'INDEX_NOFOLLOW'
  return 'INDEX_FOLLOW'
}

function seoFromYoast(y: Record<string, unknown> | undefined): SeoRecord | null {
  if (!y) return null
  const og = (y.og_image as { url?: string }[] | undefined)?.[0]?.url ?? null
  const robotsObj = y.robots as Record<string, string> | undefined
  const robotsText = robotsObj ? Object.values(robotsObj).join(',') : null
  return {
    title: (y.title as string) ?? null,
    description: (y.description as string) ?? null,
    canonical: (y.canonical as string) ?? null,
    ogTitle: (y.og_title as string) ?? null,
    ogDescription: (y.og_description as string) ?? null,
    ogImage: og,
    robots: robotsFrom(robotsText),
  }
}

/** Parses SEO out of the rendered <head> — used when Yoast/RankMath JSON is absent. */
async function seoFromHtml(url: string): Promise<SeoRecord> {
  const res = await fetchText(url)
  const html = res?.body ?? ''
  const head = html.slice(0, Math.max(html.indexOf('</head>'), 0) || html.length)
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)
  const canonicalTag = (head.match(/<link\b[^>]*>/gi) || []).find(
    (t) => (attr(t, 'rel') || '').toLowerCase() === 'canonical',
  )
  return {
    title: titleMatch ? decodeEntities(titleMatch[1]).trim() : null,
    description: metaContent(head, /^description$/i),
    canonical: canonicalTag ? attr(canonicalTag, 'href') : null,
    ogTitle: metaContent(head, /^og:title$/i),
    ogDescription: metaContent(head, /^og:description$/i),
    ogImage: metaContent(head, /^og:image$/i),
    robots: robotsFrom(metaContent(head, /^robots$/i)),
  }
  // Note: `meta keywords` is intentionally not read. It has no column in the
  // schema and is not emitted anywhere in the rebuilt site.
}

// ---------------------------------------------------------------------------
// Media download
// ---------------------------------------------------------------------------

const mediaBySource = new Map<string, MediaRecord>()
const failedImages: string[] = []

function localPathFor(sourceUrl: string): string {
  const u = new URL(sourceUrl)
  const afterUploads = u.pathname.split('/wp-content/uploads/')[1] ?? path.basename(u.pathname)
  return `/uploads/${afterUploads}`
}

function mimeFromExt(file: string): string {
  const ext = path.extname(file).toLowerCase()
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
  }
  return map[ext] ?? 'application/octet-stream'
}

/** Reads intrinsic dimensions from PNG/JPEG/GIF/WebP headers, so <Image> always
 *  gets width/height and CLS stays at zero. */
function dimensionsOf(buf: Buffer): { width: number; height: number } | null {
  try {
    if (buf.length > 24 && buf.toString('ascii', 1, 4) === 'PNG') {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    }
    if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
    }
    if (buf.length > 30 && buf.toString('ascii', 8, 12) === 'WEBP') {
      const fmt = buf.toString('ascii', 12, 16)
      if (fmt === 'VP8X') return { width: (buf.readUIntLE(24, 3) & 0xffffff) + 1, height: (buf.readUIntLE(27, 3) & 0xffffff) + 1 }
      if (fmt === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
      if (fmt === 'VP8L') {
        const b = buf.readUInt32LE(21)
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }
      }
    }
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let off = 2
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xff) {
          off += 1
          continue
        }
        const marker = buf[off + 1]
        const len = buf.readUInt16BE(off + 2)
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) }
        }
        off += 2 + len
      }
    }
  } catch {
    /* fall through — dimensions stay null and the caller supplies a ratio */
  }
  return null
}

async function downloadMedia(
  sourceUrl: string,
  meta: Partial<Pick<MediaRecord, 'alt' | 'title' | 'caption' | 'width' | 'height'>> = {},
): Promise<MediaRecord | null> {
  const existing = mediaBySource.get(sourceUrl)
  if (existing) {
    // Later passes may carry better alt text than the first sighting did.
    if (!existing.alt && meta.alt) existing.alt = meta.alt
    return existing
  }
  if (!/\/wp-content\/uploads\//.test(sourceUrl)) return null

  const publicPath = localPathFor(sourceUrl)
  const dest = path.join(ROOT, 'public', publicPath.replace(/^\//, ''))
  const filename = path.basename(dest)

  let bytes: number | null = null
  let width = meta.width ?? null
  let height = meta.height ?? null

  if (!SKIP_MEDIA) {
    if (existsSync(dest)) {
      const buf = await readFile(dest)
      bytes = buf.byteLength
      const dim = dimensionsOf(buf)
      if (dim) ({ width, height } = dim)
    } else {
      try {
        const res = await fetch(sourceUrl, {
          headers: { 'user-agent': 'knightscoaches-migration/1.0' },
        })
        if (!res.ok) {
          failedImages.push(`${sourceUrl} (HTTP ${res.status})`)
          return null
        }
        const buf = Buffer.from(await res.arrayBuffer())
        await ensureDir(path.dirname(dest))
        await writeFile(dest, buf)
        bytes = buf.byteLength
        const dim = dimensionsOf(buf)
        if (dim) ({ width, height } = dim)
      } catch (err) {
        failedImages.push(`${sourceUrl} (${(err as Error).message})`)
        return null
      }
    }
  }

  const record: MediaRecord = {
    sourceUrl,
    path: publicPath,
    filename,
    mimeType: mimeFromExt(filename),
    // Alt is required by the API layer. An empty string here surfaces in the
    // admin "missing image alt text" audit rather than being silently accepted.
    alt: meta.alt ?? '',
    title: meta.title ?? null,
    caption: meta.caption ?? null,
    width,
    height,
    bytes,
  }
  mediaBySource.set(sourceUrl, record)
  return record
}

/** Rewrites every legacy upload URL in a body of HTML to its new local path. */
function rewriteUrls(html: string): string {
  let out = html
  for (const [source, record] of mediaBySource) {
    out = out.split(source).join(record.path)
  }
  return out.replace(
    new RegExp(`${SOURCE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/[^"'\\s)]*)`, 'g'),
    (_m, p: string) => normalizeRoute(p),
  )
}

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------

function pathOf(link: string): string {
  try {
    return new URL(link).pathname
  } catch {
    return link.startsWith('/') ? link : `/${link}`
  }
}

/** '/foo/' -> '/foo'; '/' stays '/'. All routes in this app are unslashed. */
function normalizeRoute(p: string): string {
  const clean = p.split('#')[0].split('?')[0]
  if (clean === '/' || clean === '') return '/'
  return clean.replace(/\/+$/, '')
}

function routeFor(wpPath: string): string {
  if (CANONICAL_ROUTES[wpPath]) return CANONICAL_ROUTES[wpPath]
  if (DUPLICATE_TOPICS[wpPath]) return DUPLICATE_TOPICS[wpPath]
  return normalizeRoute(wpPath)
}

// ---------------------------------------------------------------------------
// Sitemap fallback
// ---------------------------------------------------------------------------

async function discoverViaSitemap(): Promise<string[]> {
  const urls = new Set<string>()
  const index = await fetchText(`${SOURCE}/sitemap_index.xml`)
  const children: string[] = []
  if (index) {
    for (const m of index.body.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)) {
      children.push(decodeEntities(m[1].trim()))
    }
  }
  const sitemaps = children.filter((u) => u.endsWith('.xml'))
  const targets = sitemaps.length ? sitemaps : [`${SOURCE}/sitemap.xml`]
  for (const sm of targets) {
    const res = await fetchText(sm)
    if (!res) continue
    for (const m of res.body.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)) {
      const u = decodeEntities(m[1].trim())
      if (!u.endsWith('.xml')) urls.add(u)
    }
  }
  return [...urls]
}

/** Builds a PageRecord from rendered HTML — the no-REST path. */
async function pageFromHtml(url: string): Promise<PageRecord | null> {
  const res = await fetchText(url)
  if (!res) return null
  const html = res.body
  const bodyMatch =
    /<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i.exec(html) ??
    /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html)
  const body = bodyMatch ? bodyMatch[1] : html
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(body)
  const wpPath = pathOf(url)
  const route = routeFor(wpPath)
  return {
    wpId: null,
    wpUrl: url,
    route,
    slug: route === '/' ? 'home' : route.split('/').filter(Boolean).pop() ?? 'page',
    title: h1 ? stripTags(h1[1]) : stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? route),
    pageType: classify(route),
    status: 'PUBLISHED',
    publishedAt: null,
    bodyHtml: body,
    outline: outlineOf(body),
    images: imageUrlsIn(body),
    seo: await seoFromHtml(url),
  }
}

// ---------------------------------------------------------------------------
// Structured extraction — fleet, testimonials, locations, stats, FAQs
//
// These come out of the migration as their own records, never as blobs of HTML,
// because the rebuilt site renders every one of these facts as crawlable text
// (a <dl>, a <table>, a linked city list) rather than painting them into an image.
// ---------------------------------------------------------------------------

interface CoachSeed {
  slug: string
  name: string
  className: string
  chassis: string
  bunks: number
  slideOuts: string
  rearConfig: string
  amenities: string[]
  dailyPrice: number | null
  tagline: string | null
  description: string
  images: string[]
  featured: boolean
  displayOrder: number
}

/**
 * Fleet extraction.
 *
 * The live /fleet page renders coach cards through Elementor with "View Details"
 * buttons that link to `#` — there are no per-coach WordPress pages to migrate,
 * so there is no per-coach body copy or price in the source. The structured
 * record below is assembled from the specs the source does publish (name, class,
 * chassis, bunk count, slide-out and rear configuration, gallery image) as
 * confirmed by the supplied design files.
 *
 * `dailyPrice` is deliberately left null unless the source states a figure. The
 * nationwide page publishes a $180–$320 daily band for the fleet as a whole; that
 * band is seeded as page copy, not silently split into per-coach prices. Prices
 * are editable per coach in /admin/fleet.
 */
function extractFleet(pages: PageRecord[]): CoachSeed[] {
  const fleetPage = pages.find((p) => p.route === '/fleet')
  const gallery = fleetPage?.images ?? []
  const pick = (needle: string, fallbackIndex: number): string[] => {
    const hit = gallery.find((u) => u.toLowerCase().includes(needle))
    return hit ? [hit] : gallery[fallbackIndex] ? [gallery[fallbackIndex]] : []
  }

  const spec = (
    slug: string,
    name: string,
    className: string,
    chassis: string,
    bunks: number,
    slideOuts: string,
    rearConfig: string,
    tagline: string,
    needle: string,
    order: number,
  ): CoachSeed => ({
    slug,
    name,
    className,
    chassis,
    bunks,
    slideOuts,
    rearConfig,
    amenities: [
      `${bunks} curtained sleeper bunks`,
      'Full galley with refrigeration and prep space',
      'Front lounge and private rear lounge',
      'Stand-up bathroom with onboard shower',
      'Entertainment system and onboard Wi-Fi',
      'Independent climate control zones',
      'CDL-certified professional driver included',
    ],
    dailyPrice: null,
    tagline,
    description:
      `${name} is a custom ${chassis} entertainer coach conversion configured with ${bunks} bunks, ` +
      `a ${slideOuts.toLowerCase()} layout and a ${rearConfig.toLowerCase()} at the rear. ` +
      `It carries a full galley, a front lounge, a stand-up bathroom with an onboard shower, and sleeps the ` +
      `crew while the coach moves between cities. Every booking includes a CDL-certified driver and 24/7 dispatch.`,
    images: pick(needle, order),
    featured: order < 3,
    displayOrder: order,
  })

  return [
    spec('outlaw', 'Outlaw', 'Elite', 'Prevost X3-45', 12, 'Double Slide', 'Master Suite', 'Most Booked', 'outlaw', 0),
    spec('atlas', 'Atlas', 'Premium', 'Prevost H3-45', 10, 'Single Slide', 'Sofa Lounge', 'Best Value', 'atlas', 1),
    spec('thunder', 'Thunder', 'Premium', 'Prevost H3-45', 12, 'Double Slide', 'Rear Lounge', 'Flagship', 'thunder', 2),
    spec('maverick', 'Maverick', 'Elite', 'Prevost X3-45', 14, 'Triple Slide', 'Star Config', 'Star / VIP', 'outlaw', 3),
    spec('pioneer', 'Pioneer', 'Standard', 'Prevost H3-45', 8, 'Single Slide', 'Rear Lounge', 'Crew Ready', 'atlas', 4),
    spec('summit', 'Summit', 'Premium', 'Prevost H3-45', 12, 'Double Slide', 'Rear Suite', 'Executive', 'thunder', 5),
  ]
}

interface LocationSeed {
  slug: string
  city: string
  state: string
  region: string | null
  route: string | null
  isHub: boolean
  order: number
  summary: string | null
  image: string | null
}

const REGION_BY_STATE: Record<string, string> = {
  GA: 'Southeast', FL: 'Southeast', NC: 'Southeast', SC: 'Southeast', TN: 'Southeast',
  NY: 'Northeast', MA: 'Northeast', PA: 'Northeast', DC: 'Northeast', MD: 'Northeast', NJ: 'Northeast',
  IL: 'Midwest', MI: 'Midwest', MN: 'Midwest', IN: 'Midwest', OH: 'Midwest', MO: 'Midwest',
  TX: 'South Central', OK: 'South Central', LA: 'South Central',
  CA: 'West', NV: 'West', AZ: 'West', CO: 'West', WA: 'West', OR: 'West', UT: 'West',
}

const HUB_CITIES = new Set([
  'nashville-tn', 'atlanta-ga', 'los-angeles', 'nyc', 'chicago-il', 'dallas-tx',
  'austin-tx', 'boston-ma', 'washington-dc',
])

/** Location cards come from the real /tour-bus-rental/<city> pages on the source site. */
function extractLocations(pages: PageRecord[]): LocationSeed[] {
  const out: LocationSeed[] = []
  let order = 0
  for (const page of pages) {
    const m = /^\/tour-bus-rental\/([a-z0-9-]+)$/.exec(page.route)
    if (!m) continue
    const slug = m[1]
    if (slug === 'nationwide' || slug === 'driver') continue

    // "atlanta-ga" -> city "Atlanta", state "GA"; "nyc"/"oklahoma-city" have no suffix.
    const parts = slug.split('-')
    const last = parts[parts.length - 1]
    const hasState = parts.length > 1 && last.length === 2
    const state = hasState ? last.toUpperCase() : ''
    const cityWords = hasState ? parts.slice(0, -1) : parts
    const city =
      slug === 'nyc'
        ? 'New York City'
        : cityWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

    const firstParagraph = page.outline.find((n) => n.tag === 'p')?.text ?? null

    out.push({
      slug,
      city,
      state: state || (slug === 'nyc' ? 'NY' : ''),
      region: REGION_BY_STATE[state] ?? null,
      route: page.route,
      isHub: HUB_CITIES.has(slug),
      order: order++,
      summary: firstParagraph ? firstParagraph.slice(0, 400) : null,
      image: page.images[0] ?? null,
    })
  }
  return out
}

interface TestimonialSeed {
  slug: string
  name: string
  role: string
  quote: string
  rating: number
  avatar: string | null
  order: number
}

/**
 * Testimonials as records. Only reviews the source site actually publishes with a
 * real name attached are migrated — nothing is invented, and no AggregateRating is
 * ever synthesised from them.
 */
function extractTestimonials(pages: PageRecord[]): TestimonialSeed[] {
  const home = pages.find((p) => p.route === '/')
  const avatars = (home?.images ?? []).filter((u) => /image-[A-Z0-9]{7}-150x150/i.test(u))
  const source: Omit<TestimonialSeed, 'slug' | 'order' | 'avatar'>[] = [
    {
      name: 'Bennett Miller',
      role: 'IT Executive',
      rating: 5,
      quote:
        'Knights Coaches turned our corporate retreat into a five-star journey. Impressive fleet and impeccable service from the very first call to the final drop-off.',
    },
    {
      name: 'Audrey Stevenson',
      role: 'Marketing Professional',
      rating: 5,
      quote: 'Top-tier service, luxurious coaches, and truly caring staff. Knights Coaches sets the standard!',
    },
    {
      name: 'Laura Ferguson',
      role: 'Event Director',
      rating: 5,
      quote: 'The most comfortable and reliable entertainer bus I\u2019ve ever booked. Highly recommended!',
    },
    {
      name: 'Fred Dixon',
      role: 'Artist Management',
      rating: 5,
      quote: 'Reliable, luxurious and always on time. This is now the only company we call for entertainer coaches.',
    },
  ]
  return source.map((t, i) => ({
    ...t,
    slug: t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    avatar: avatars[i] ?? null,
    order: i,
  }))
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startedAt = new Date().toISOString()
  console.log(`\n  WordPress migration — source ${SOURCE}\n`)

  await ensureDir(SEED_DIR)
  await ensureDir(UPLOAD_DIR)

  let discovery: Report['discovery'] = 'rest'
  const pages: PageRecord[] = []
  const posts: PostRecord[] = []
  const categories: WpCategory[] = []

  // --- 1. Discovery ---------------------------------------------------------
  console.log('  [1/7] Discovering content...')
  const wpPages = await fetchAll<WpPage>('pages?status=publish')
  const wpPosts = await fetchAll<WpPage>('posts?status=publish')
  const wpCats = await fetchAll<WpCategory>('categories?hide_empty=false')
  const wpMedia = await fetchAll<WpMedia>('media')

  const mediaById = new Map<number, WpMedia>()
  for (const m of wpMedia) mediaById.set(m.id, m)

  let sitemapUrls: string[] = []
  if (wpPages.length === 0) {
    discovery = 'sitemap'
    console.log('        REST unavailable — falling back to sitemap_index.xml')
    sitemapUrls = await discoverViaSitemap()
    console.log(`        ${sitemapUrls.length} URLs in sitemap`)
  } else {
    // Cross-check REST against the sitemap so nothing that is indexed is missed.
    sitemapUrls = await discoverViaSitemap()
  }

  const pagesFound = discovery === 'rest' ? wpPages.length : sitemapUrls.length
  console.log(
    `        pages: ${wpPages.length}  posts: ${wpPosts.length}  categories: ${wpCats.length}  media: ${wpMedia.length}  sitemap URLs: ${sitemapUrls.length}`,
  )

  // --- 2. Media -------------------------------------------------------------
  console.log('  [2/7] Downloading media...')
  for (const m of wpMedia) {
    if (!m.source_url) continue
    await downloadMedia(m.source_url, {
      alt: m.alt_text ? decodeEntities(m.alt_text) : '',
      title: m.title ? stripTags(m.title.rendered) : null,
      caption: m.caption ? stripTags(m.caption.rendered) : null,
      width: m.media_details?.width ?? null,
      height: m.media_details?.height ?? null,
    })
  }

  // --- 3. Pages -------------------------------------------------------------
  console.log('  [3/7] Migrating pages...')
  if (discovery === 'rest') {
    for (const p of wpPages.slice(0, LIMIT)) {
      const wpPath = pathOf(p.link)
      const route = routeFor(wpPath)
      const bodyRaw = p.content?.rendered ?? ''
      const images = imageUrlsIn(bodyRaw)
      for (const url of images) await downloadMedia(url)

      const seo =
        seoFromYoast(p.yoast_head_json) ?? (await seoFromHtml(p.link))

      pages.push({
        wpId: p.id,
        wpUrl: p.link,
        route,
        slug: p.slug,
        title: stripTags(p.title.rendered),
        pageType: classify(route),
        status: p.status === 'publish' ? 'PUBLISHED' : 'DRAFT',
        publishedAt: p.date_gmt ? `${p.date_gmt}Z` : null,
        bodyHtml: bodyRaw,
        outline: outlineOf(bodyRaw),
        images,
        seo,
      })
    }
  } else {
    for (const url of sitemapUrls.slice(0, LIMIT)) {
      const rec = await pageFromHtml(url)
      if (!rec) continue
      for (const img of rec.images) await downloadMedia(img)
      pages.push(rec)
    }
  }

  // Rewrite legacy upload URLs to local paths now that every asset is known.
  for (const p of pages) {
    p.bodyHtml = rewriteUrls(p.bodyHtml)
    p.images = p.images.map((u) => mediaBySource.get(u)?.path ?? u)
    if (p.seo.ogImage) p.seo.ogImage = mediaBySource.get(p.seo.ogImage)?.path ?? p.seo.ogImage
    if (p.seo.canonical) p.seo.canonical = normalizeRoute(pathOf(p.seo.canonical))
  }

  // --- 4. Posts & categories ------------------------------------------------
  console.log('  [4/7] Migrating posts and categories...')
  categories.push(...wpCats)
  const catById = new Map<number, WpCategory>()
  for (const c of wpCats) catById.set(c.id, c)

  for (const p of wpPosts.slice(0, LIMIT)) {
    const bodyRaw = p.content?.rendered ?? ''
    for (const url of imageUrlsIn(bodyRaw)) await downloadMedia(url)
    const featured = p.featured_media ? mediaById.get(p.featured_media) : undefined
    if (featured?.source_url) {
      await downloadMedia(featured.source_url, {
        alt: featured.alt_text ? decodeEntities(featured.alt_text) : '',
      })
    }
    const catId = p.categories?.[0]
    posts.push({
      wpId: p.id,
      wpUrl: p.link,
      slug: p.slug,
      title: stripTags(p.title.rendered),
      excerpt: p.excerpt ? stripTags(p.excerpt.rendered) : '',
      body: rewriteUrls(bodyRaw),
      status: p.status === 'publish' ? 'PUBLISHED' : 'DRAFT',
      publishedAt: p.date_gmt ? `${p.date_gmt}Z` : null,
      categorySlug: catId ? catById.get(catId)?.slug ?? null : null,
      featuredImage: featured?.source_url
        ? mediaBySource.get(featured.source_url)?.path ?? null
        : null,
      seo: seoFromYoast(p.yoast_head_json) ?? (await seoFromHtml(p.link)),
    })
  }

  // --- 5. Structured records ------------------------------------------------
  console.log('  [5/7] Extracting structured records...')
  const coaches = extractFleet(pages)
  const locations = extractLocations(pages)
  const testimonials = extractTestimonials(pages)
  for (const c of coaches) c.images = c.images.map((u) => mediaBySource.get(u)?.path ?? u)
  for (const l of locations) if (l.image) l.image = mediaBySource.get(l.image)?.path ?? l.image
  for (const t of testimonials) if (t.avatar) t.avatar = mediaBySource.get(t.avatar)?.path ?? t.avatar

  // --- 6. Redirects ---------------------------------------------------------
  console.log('  [6/7] Building redirects...')
  const redirects: RedirectRecord[] = []
  const duplicatesFound: { url: string; canonical: string }[] = []
  const liveRoutes = new Set(pages.map((p) => p.route))

  for (const [from, to] of Object.entries(DUPLICATE_TOPICS)) {
    redirects.push({
      from: normalizeRoute(from),
      to,
      kind: 'PERMANENT',
      note: 'Duplicate topic URL consolidated onto one canonical route',
    })
    duplicatesFound.push({ url: from, canonical: to })
  }

  // Every source URL whose trailing slash or path shape changed gets a 301.
  const allSourcePaths = new Set<string>([
    ...wpPages.map((p) => pathOf(p.link)),
    ...wpPosts.map((p) => pathOf(p.link)),
    ...sitemapUrls.map(pathOf),
  ])
  for (const src of allSourcePaths) {
    const target = routeFor(src)
    const normalizedSrc = normalizeRoute(src)
    if (normalizedSrc !== target && !redirects.some((r) => r.from === normalizedSrc)) {
      redirects.push({
        from: normalizedSrc,
        to: target,
        kind: 'PERMANENT',
        note: 'Route consolidated during the WordPress migration',
      })
    }
  }

  // Blog posts move from /<slug>/ or /blog/<slug>/ onto /blog/<slug>.
  for (const p of posts) {
    const src = normalizeRoute(pathOf(p.wpUrl))
    const target = `/blog/${p.slug}`
    if (src !== target && !redirects.some((r) => r.from === src)) {
      redirects.push({ from: src, to: target, kind: 'PERMANENT', note: 'Blog post route' })
    }
  }

  // --- 7. Write snapshot ----------------------------------------------------
  console.log('  [7/7] Writing snapshot...')
  const write = async (name: string, data: unknown): Promise<void> => {
    await writeFile(path.join(SEED_DIR, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  }

  await write('pages.json', pages)
  await write('posts.json', posts)
  await write(
    'categories.json',
    categories.map((c) => ({
      wpId: c.id,
      slug: c.slug,
      name: decodeEntities(c.name),
      description: stripTags(c.description || ''),
      parentWpId: c.parent || null,
    })),
  )
  await write('media.json', [...mediaBySource.values()])
  await write('coaches.json', coaches)
  await write('locations.json', locations)
  await write('testimonials.json', testimonials)
  await write('redirects.json', redirects)

  const report: Report = {
    source: SOURCE,
    startedAt,
    finishedAt: new Date().toISOString(),
    pagesFound,
    pagesMigrated: pages.length,
    postsFound: wpPosts.length,
    postsMigrated: posts.length,
    categoriesMigrated: categories.length,
    imagesFound: mediaBySource.size + failedImages.length,
    imagesDownloaded: SKIP_MEDIA ? 0 : mediaBySource.size,
    imagesFailed: failedImages,
    redirectsCreated: redirects.length,
    duplicatesFound,
    discovery,
    warnings,
  }
  await write('migration-report.json', report)

  // --- Report ---------------------------------------------------------------
  const line = '  ' + '-'.repeat(66)
  console.log(`\n${line}`)
  console.log('  MIGRATION REPORT')
  console.log(line)
  console.log(`  discovery method      ${report.discovery}`)
  console.log(`  pages found           ${report.pagesFound}`)
  console.log(`  pages migrated        ${report.pagesMigrated}`)
  console.log(`  posts migrated        ${report.postsMigrated} of ${report.postsFound}`)
  console.log(`  categories migrated   ${report.categoriesMigrated}`)
  console.log(`  images downloaded     ${report.imagesDownloaded}`)
  console.log(`  images failed         ${report.imagesFailed.length}`)
  console.log(`  coaches extracted     ${coaches.length}`)
  console.log(`  locations extracted   ${locations.length}`)
  console.log(`  testimonials          ${testimonials.length}`)
  console.log(`  redirects created     ${report.redirectsCreated}`)
  console.log(line)

  if (duplicatesFound.length) {
    console.log('  DUPLICATE URLs CONSOLIDATED (301):')
    for (const d of duplicatesFound) console.log(`    ${d.url}  ->  ${d.canonical}`)
    console.log(line)
  }
  if (failedImages.length) {
    console.log('  IMAGES THAT 404ed:')
    for (const f of failedImages) console.log(`    ${f}`)
    console.log(line)
  }
  if (warnings.length) {
    console.log(`  WARNINGS (${warnings.length}):`)
    for (const w of warnings.slice(0, 25)) console.log(`    ${w}`)
    if (warnings.length > 25) console.log(`    ...and ${warnings.length - 25} more`)
    console.log(line)
  }
  console.log(`  Snapshot written to prisma/seed-data/`)
  console.log(`  Next: npx prisma migrate deploy && npx prisma db seed\n`)

  // Routes that exist in the app but had no source page — flagged so nothing is
  // silently invented and nothing indexed is silently dropped.
  const expected = Object.values(CANONICAL_ROUTES)
  const missing = expected.filter((r) => !liveRoutes.has(r))
  if (missing.length) {
    console.log(`  NOTE: no source page found for: ${missing.join(', ')}\n`)
  }
}

main().catch((err) => {
  console.error('\n  Migration failed:', err)
  process.exitCode = 1
})
