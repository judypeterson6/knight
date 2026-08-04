/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
    ]
  },
}

export default nextConfig
