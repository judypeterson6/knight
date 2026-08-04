import { sitemapEntries, urlsetXml, XML_HEADERS } from '@/lib/sitemap'

export const revalidate = 3600

export async function GET(): Promise<Response> {
  const entries = await sitemapEntries('categories')
  return new Response(urlsetXml(entries), { headers: XML_HEADERS })
}
