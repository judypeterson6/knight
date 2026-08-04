import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { BLOCK_LIBRARY, BLOCK_CATEGORIES, defaultPropsFor } from '@/lib/blocks/registry'
import { BLOCK_TYPES } from '@/lib/blocks/schema'
import { BlockBuilder } from '@/components/admin/block-builder'
import { AdminPageHeader } from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function PageEditor({ params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole('EDITOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const { id } = await params
  const page = await prisma.page
    .findUnique({ where: { id }, include: { blocks: { orderBy: { order: 'asc' } } } })
    .catch(() => null)

  if (!page) notFound()

  const [seo, media, revisions] = await Promise.all([
    prisma.seoMeta.findUnique({ where: { entityType_entityId: { entityType: 'PAGE', entityId: page.id } } }).catch(() => null),
    prisma.media.findMany({ orderBy: { createdAt: 'desc' }, take: 300, select: { id: true, path: true, alt: true, decorative: true, filename: true, width: true, height: true } }).catch(() => []),
    prisma.pageRevision
      .findMany({
        where: { pageId: page.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { author: { select: { name: true } } },
      })
      .catch(() => []),
  ])

  // The library metadata plus each type's parsed defaults, so inserting a block
  // client-side never needs a round trip.
  const library = BLOCK_LIBRARY.map((meta) => ({ ...meta, defaults: defaultPropsFor(meta.type) }))

  return (
    <>
      <AdminPageHeader
        title={page.title}
        description={`${page.path} · ${page.pageType} · ${page.blocks.length} blocks`}
        actions={
          <>
            <Link href={page.path} className="kc-btn kc-btn-outline !px-5 !py-2.5">
              View page
            </Link>
            <Link href="/admin/pages" className="kc-btn kc-btn-outline !px-5 !py-2.5">
              All pages
            </Link>
          </>
        }
      />

      <BlockBuilder
        pageId={page.id}
        pagePath={page.path}
        page={{ title: page.title, slug: page.slug, path: page.path, pageType: page.pageType, status: page.status, customCss: page.customCss ?? '' }}
        initialBlocks={page.blocks.map((b) => ({
          id: b.id,
          type: b.type as (typeof BLOCK_TYPES)[number],
          order: b.order,
          visible: b.visible,
          props: b.props as Record<string, unknown>,
        }))}
        library={library}
        categories={[...BLOCK_CATEGORIES]}
        media={media}
        seo={seo}
        revisions={revisions.map((r) => ({
          id: r.id,
          note: r.note,
          author: r.author?.name ?? 'Unknown',
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </>
  )
}
