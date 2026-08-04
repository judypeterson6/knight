import { sitemapIndexXml, XML_HEADERS } from '@/lib/sitemap'

export const revalidate = 3600

/** Sitemap index. One child sitemap per content type; see /lib/sitemap.ts. */
export async function GET(): Promise<Response> {
  return new Response(await sitemapIndexXml(), { headers: XML_HEADERS })
}
