import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader } from '@/components/admin/ui'
import { MediaLibrary } from '@/components/admin/media-library'

export const dynamic = 'force-dynamic'

export default async function MediaAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const gate = await requireRole('AUTHOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const { q } = await searchParams
  const media = await prisma.media
    .findMany({
      where: q ? { OR: [{ filename: { contains: q } }, { alt: { contains: q } }, { caption: { contains: q } }] } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 400,
    })
    .catch(() => [])

  const missingAlt = await prisma.media.count({ where: { alt: '', decorative: false } }).catch(() => 0)

  return (
    <>
      <AdminPageHeader
        title="Media"
        description="Alt text is required at upload. Deleting an asset that is still in use is blocked unless you explicitly override it."
      />

      {missingAlt > 0 ? (
        <p className="mb-6 rounded-card border border-line bg-surface-alt p-4 text-step--1 text-muted">
          <strong className="text-ink">{missingAlt}</strong> assets arrived from the WordPress migration with no alt
          text. They are listed in the{' '}
          <Link className="font-bold text-primary underline" href="/admin/seo/audit">
            SEO audit
          </Link>{' '}
          and cannot be added to a coach gallery until they are labelled.
        </p>
      ) : null}

      <MediaLibrary
        initial={media.map((m) => ({
          id: m.id,
          path: m.path,
          filename: m.filename,
          alt: m.alt,
          decorative: m.decorative,
          title: m.title ?? '',
          caption: m.caption ?? '',
          width: m.width,
          height: m.height,
          bytes: m.bytes,
          mimeType: m.mimeType,
        }))}
        query={q ?? ''}
      />
    </>
  )
}
