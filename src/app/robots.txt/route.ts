import { getSettings } from '@/lib/settings'
import { absoluteUrl } from '@/lib/utils'

export const revalidate = 3600

/**
 * robots.txt. The body is editable in /admin/seo/robots; when that setting is
 * blank the default below is served, which always points at the sitemap index.
 */
export async function GET(): Promise<Response> {
  const { seo } = await getSettings()

  const body =
    seo.robotsTxt.trim() ||
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /api/',
      '',
      '# Retired WordPress asset trees. Googlebot was still requesting several',
      '# hundred Elementor and plugin stylesheets from the old site, which is',
      '# why crawl activity ran at roughly 47% CSS against 11% HTML. They also',
      '# answer 410, but disallowing them stops the requests being made at all.',
      '#',
      '# /wp-content/uploads stays allowed: those URLs 301 onto the images that',
      '# replaced them, and blocking them would stop the redirects being followed.',
      'Disallow: /wp-content/plugins/',
      'Disallow: /wp-content/themes/',
      'Disallow: /wp-content/cache/',
      'Disallow: /wp-includes/',
      'Disallow: /wp-admin/',
      'Disallow: /wp-json/',
      '',
      '# CSS and JavaScript under /_next are needed to render these pages and',
      '# must stay crawlable; blocking them would have Google index the site',
      '# unstyled.',
      'Allow: /_next/static/',
      '',
      `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
      '',
    ].join('\n')

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
