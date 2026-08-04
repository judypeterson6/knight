import { prisma } from '@/lib/prisma'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { seoUpdateSchema } from '@/lib/admin-schemas'
import { revalidateStructuredContent } from '@/lib/revalidate'

export const runtime = 'nodejs'

/** Per-entity SEO override. There is no keywords field — by design. */
export async function GET(request: Request): Promise<Response> {
  const gate = await guard('EDITOR')
  if (!gate.ok) return gate.response

  const url = new URL(request.url)
  const entityType = url.searchParams.get('entityType')
  const entityId = url.searchParams.get('entityId')
  if (!entityType || !entityId) return fail('entityType and entityId are required')

  const parsed = seoUpdateSchema.shape.entityType.safeParse(entityType)
  if (!parsed.success) return fail('Unknown entityType')

  const meta = await prisma.seoMeta.findUnique({
    where: { entityType_entityId: { entityType: parsed.data, entityId } },
  })
  return ok(meta)
}

export async function PUT(request: Request): Promise<Response> {
  const gate = await guard('EDITOR')
  if (!gate.ok) return gate.response

  const body = await parseBody(request, seoUpdateSchema)
  if (!body.ok) return body.response

  const { entityType, entityId, ...fields } = body.data
  const data = {
    title: fields.title ?? null,
    description: fields.description ?? null,
    canonical: fields.canonical ?? null,
    ogTitle: fields.ogTitle ?? null,
    ogDescription: fields.ogDescription ?? null,
    ogImage: fields.ogImage ?? null,
    robots: fields.robots,
    schemaType: fields.schemaType ?? null,
    sitemapExclude: fields.sitemapExclude,
    sitemapPriority: fields.sitemapPriority ?? null,
    sitemapChangefreq: fields.sitemapChangefreq ?? null,
  }

  const meta = await prisma.seoMeta.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: { entityType, entityId, ...data },
    update: data,
  })

  revalidateStructuredContent()
  return ok(meta)
}
