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
