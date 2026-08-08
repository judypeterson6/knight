import { NextResponse, type NextRequest } from 'next/server'

/**
 * Edge middleware.
 *
 * Responsibilities, in order:
 *   1. Serve the IndexNow key file at /<key>.txt.
 *   2. Canonicalise the host and scheme: one origin, https, no www.
 *   3. Normalise trailing slashes so every old WordPress URL (which ended in a
 *      slash) resolves to its unslashed equivalent with a 301.
 *   3. Look up database-backed redirects through an internal API route.
 *      Middleware runs on the edge runtime and cannot open a MySQL connection,
 *      so the lookup is delegated to /api/internal/redirect, which is cached.
 *   4. Publish the current pathname on a request header so the layout can mark
 *      the active nav item without becoming a client component.
 *   5. Gate /admin — the session cookie is checked here, and every mutation
 *      re-checks the role server-side.
 */

const PUBLIC_FILE = /\.(?:png|jpe?g|gif|svg|webp|avif|ico|css|js|map|woff2?|ttf|mp4|webm|xml|txt|json)$/i

/**
 * The one host this site answers on, from NEXT_PUBLIC_SITE_URL.
 *
 * Returns null when that points at localhost, so development is never
 * redirected. Middleware runs on the edge runtime, so this reads the inlined
 * public variable rather than importing anything server-side.
 */
function canonicalHost(): { host: string } | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL
  if (!raw) return null
  try {
    const url = new URL(raw)
    const host = url.host.toLowerCase().replace(/^www\./, '')
    if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return null
    return { host }
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // --- 1. IndexNow key file -------------------------------------------------
  const indexNowKey = process.env.INDEXNOW_KEY
  if (indexNowKey && pathname === `/${indexNowKey}.txt`) {
    return new NextResponse(indexNowKey, {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' },
    })
  }

  if (pathname.startsWith('/_next') || pathname.startsWith('/api/internal')) {
    return NextResponse.next()
  }

  // --- 2. Canonical host and scheme ----------------------------------------
  //
  // One origin: https://knightscoaches.com. www and http are 301'd onto it so
  // the same page is never reachable at four addresses, which would split
  // ranking signals and make the canonical tag argue with the URL it was
  // served from.
  //
  // The scheme comes from x-forwarded-proto because TLS terminates at the
  // proxy — request.nextUrl.protocol reads http on every request behind one.
  // Localhost and preview hosts are left alone so development still works.
  const canonical = canonicalHost()
  if (canonical) {
    const host = (request.headers.get('host') ?? '').toLowerCase()
    const proto = (request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '')).toLowerCase()
    const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]')
    const hostMatches = host === canonical.host
    const protoMatches = proto === 'https'

    if (!isLocal && (!hostMatches || !protoMatches)) {
      // Only redirect hosts we actually own, so a preview deployment or a
      // health check on an unrelated hostname is not bounced away.
      if (hostMatches || host === `www.${canonical.host}`) {
        const url = new URL(request.nextUrl.toString())
        url.protocol = 'https:'
        url.host = canonical.host
        url.port = ''
        return NextResponse.redirect(url, 301)
      }
    }
  }

  // --- 3. Trailing-slash normalisation -------------------------------------
  if (pathname.length > 1 && pathname.endsWith('/')) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.replace(/\/+$/, '')
    return NextResponse.redirect(url, 301)
  }

  // --- 3. Database redirects ------------------------------------------------
  if (!PUBLIC_FILE.test(pathname) && !pathname.startsWith('/api/') && !pathname.startsWith('/admin')) {
    try {
      const lookup = new URL('/api/internal/redirect', request.url)
      lookup.searchParams.set('from', pathname)
      const res = await fetch(lookup, { headers: { 'x-middleware': '1' } })
      if (res.ok) {
        const hit = (await res.json()) as { to?: string; status?: number }
        if (hit.to) {
          const url = request.nextUrl.clone()
          if (/^https?:\/\//i.test(hit.to)) return NextResponse.redirect(hit.to, hit.status ?? 301)
          url.pathname = hit.to
          return NextResponse.redirect(url, hit.status ?? 301)
        }
      }
    } catch {
      // A redirect-table outage must never block a request.
    }
  }

  // --- 5. Admin gate --------------------------------------------------------
  // /admin/login and /admin/reset-password are the two routes a signed-out user
  // legitimately needs; everything else under /admin requires a session.
  const PUBLIC_ADMIN = pathname === '/admin/login' || pathname === '/admin/reset-password'

  if (pathname.startsWith('/admin') && !PUBLIC_ADMIN) {
    const hasSession =
      request.cookies.has('authjs.session-token') ||
      request.cookies.has('__Secure-authjs.session-token') ||
      request.cookies.has('next-auth.session-token') ||
      request.cookies.has('__Secure-next-auth.session-token')

    if (!hasSession) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      url.search = `?callbackUrl=${encodeURIComponent(pathname + search)}`
      return NextResponse.redirect(url)
    }
  }

  // --- 4. Expose the pathname to server components --------------------------
  const headers = new Headers(request.headers)
  headers.set('x-pathname', pathname)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
