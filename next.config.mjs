import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // There is another package-lock.json in the user profile directory above this
  // project. Next walks up looking for one and picked that as the workspace
  // root, which would trace the wrong files into the standalone output. Pin it
  // to this directory instead.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  images: {
    // Local /public/uploads is the default store. Remote patterns cover assets that
    // still point at the legacy WordPress origin before the media migration runs.
    formats: ['image/webp'],
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
