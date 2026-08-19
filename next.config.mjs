import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next's own trailing-slash redirect runs ahead of middleware, so it was
  // answering every slashed URL with a 308 before the middleware could see it.
  // Two consequences: the middleware's 301 for old WordPress URLs never ran,
  // and every retired /wp-.../ path cost two crawl requests instead of one —
  // a 308 to the unslashed form, then the 410. Handing slash handling to the
  // middleware lets it answer both in a single response.
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
  // There is another package-lock.json in the user profile directory above this
  // project. Next walks up looking for one and picked that as the workspace
  // root, which would trace the wrong files into the standalone output. Pin it
  // to this directory instead.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  images: {
    // Local /public/uploads is the default store. Remote patterns cover assets that
    // still point at the legacy WordPress origin before the media migration runs.
    //
    // AVIF first, WebP as the fallback. The migrated library is largely PNG
    // photographs running 2 to 3 MB each, and AVIF typically lands 20 to 30
    // percent under WebP on that kind of source, which is the single biggest
    // lever on LCP here.
    formats: ['image/avif', 'image/webp'],
    // Optimised variants are derived from immutable files under /uploads, so
    // there is no reason to re-encode them on a short cycle.
    minimumCacheTTL: 31536000,
    // Next 15 requires declaring any quality value used with next/image.
    // 70 is for imagery sitting behind a dark gradient, where the loss is
    // invisible; 75 is the default; 90 is for fleet detail shots.
    qualities: [70, 75, 90],
    remotePatterns: [
      { protocol: 'https', hostname: 'knightscoaches.com', pathname: '/wp-content/uploads/**' },
      { protocol: 'https', hostname: 'www.knightscoaches.com', pathname: '/wp-content/uploads/**' },
    ],
    deviceSizes: [360, 480, 640, 828, 1080, 1200, 1600, 1920],
  },
  eslint: { dirs: ['src', 'scripts', 'prisma'] },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      {
        source: '/uploads/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // The middleware 301s http to https, but that still sends the first
        // request in the clear. HSTS makes the browser rewrite the scheme
        // itself on every later visit, so the redirect stops being reachable.
        //
        // preload is deliberately omitted: submitting to the preload list is a
        // one-way door for the whole domain including every subdomain, and
        // that is the site owner's decision to make, not a build default.
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
