import { existsSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { NextResponse } from 'next/server'
import { absoluteUrl } from '@/lib/utils'

/**
 * Legacy WordPress media URLs.
 *
 * Search Console shows Googlebot still requesting hundreds of
 * /wp-content/... URLs from the old site. The plugin and theme stylesheets
 * among them are genuinely gone, but the uploads are not: every image moved to
 * /uploads/ with the same year/month/filename, and image optimisation
 * converted many of them to WebP along the way.
 *
 * Those URLs are the ones worth keeping. They are what any external link or
 * image result still points at, so they get a 301 onto the file that replaced
 * them rather than the 404 they were returning. Only when nothing on disk
 * matches does the URL report 410, which tells a crawler to stop asking
 * instead of retrying a 404 for months.
 *
 * Resolution order for /wp-content/uploads/2026/05/Coach-1024x691.png:
 *   1. /uploads/2026/05/Coach-1024x691.png     the same file
 *   2. /uploads/2026/05/Coach-1024x691.webp    the converted one
 *   3. /uploads/2026/05/Coach.webp             the size suffix dropped
 */

// Resolved per request: the handler stats the filesystem, and a redirect with
// an empty body cannot be stored in the prerender cache — Next rejects a
// zero-size entry outright. Caching is expressed in the response headers
// instead, which is what a CDN and a crawler actually read.
export const dynamic = 'force-dynamic'

const EXTENSIONS = ['webp', 'avif', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'mp4', 'webm', 'pdf']

/** WordPress appends -WIDTHxHEIGHT for generated sizes. */
const SIZE_SUFFIX = /-\d{2,5}x\d{2,5}$/

function resolveUpload(segments: string[]): string | null {
  // Reject anything that tries to climb out of public/uploads.
  const joined = segments.join('/')
  if (!joined || joined.includes('\0')) return null
  const rel = normalize(joined).split(String.fromCharCode(92)).join('/')
  if (rel.startsWith('..') || rel.includes('../')) return null

  const candidates: string[] = [rel]

  const dot = rel.lastIndexOf('.')
  const stem = dot === -1 ? rel : rel.slice(0, dot)
  for (const ext of EXTENSIONS) candidates.push(`${stem}.${ext}`)

  if (SIZE_SUFFIX.test(stem)) {
    const unsized = stem.replace(SIZE_SUFFIX, '')
    for (const ext of EXTENSIONS) candidates.push(`${unsized}.${ext}`)
  }

  for (const candidate of candidates) {
    if (existsSync(join(process.cwd(), 'public', 'uploads', candidate))) return `/uploads/${candidate}`
  }
  return null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params
  const target = resolveUpload(path ?? [])

  if (!target) {
    // 410 rather than 404: the old media library is not coming back, and a
    // crawler retries a 404 far longer than it retries a Gone.
    return new NextResponse(null, {
      status: 410,
      headers: { 'cache-control': 'public, max-age=86400', 'x-robots-tag': 'noindex' },
    })
  }

  const response = NextResponse.redirect(absoluteUrl(target), 301)
  response.headers.set('cache-control', 'public, max-age=86400')
  return response
}
