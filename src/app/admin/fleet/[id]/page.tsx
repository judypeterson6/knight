import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader } from '@/components/admin/ui'
import { CoachEditor } from '@/components/admin/coach-editor'

export const dynamic = 'force-dynamic'

export default async function CoachEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole('EDITOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const { id } = await params
  const isNew = id === 'new'

  const [coach, classes, media] = await Promise.all([
    isNew
      ? Promise.resolve(null)
      : prisma.coach
          .findUnique({ where: { id }, include: { images: { orderBy: { order: 'asc' }, include: { media: true } } } })
          .catch(() => null),
    prisma.coachClass.findMany({ orderBy: { order: 'asc' }, select: { id: true, name: true } }).catch(() => []),
    prisma.media
      .findMany({
        orderBy: { createdAt: 'desc' },
        take: 400,
        select: { id: true, path: true, alt: true, decorative: true, filename: true },
      })
      .catch(() => []),
  ])

  if (!isNew && !coach) notFound()

  const seo = coach
    ? await prisma.seoMeta
        .findUnique({ where: { entityType_entityId: { entityType: 'COACH', entityId: coach.id } } })
        .catch(() => null)
    : null

  return (
    <>
      <AdminPageHeader
        title={isNew ? 'New coach' : coach!.name}
        description={isNew ? 'Add a coach to the fleet.' : `/fleet/${coach!.slug}`}
      />
      <CoachEditor
        coachId={isNew ? null : coach!.id}
        initial={{
          name: coach?.name ?? '',
          slug: coach?.slug ?? '',
          status: coach?.status ?? 'DRAFT',
          classId: coach?.classId ?? '',
          chassis: coach?.chassis ?? 'Prevost H3-45',
          bunks: coach?.bunks ?? 12,
          slideOuts: coach?.slideOuts ?? 'Double Slide',
          rearConfig: coach?.rearConfig ?? 'Rear Lounge',
          amenities: Array.isArray(coach?.amenities) ? (coach!.amenities as string[]) : [],
          description: coach?.description ?? '',
          tagline: coach?.tagline ?? '',
          dailyPrice: coach?.dailyPrice ?? null,
          currency: coach?.currency ?? 'USD',
          available: coach?.available ?? true,
          featured: coach?.featured ?? false,
          displayOrder: coach?.displayOrder ?? 0,
        }}
        images={(coach?.images ?? []).map((i) => ({
          mediaId: i.mediaId,
          order: i.order,
          caption: i.caption ?? '',
          path: i.media.path,
          filename: i.media.filename,
          alt: i.media.alt,
        }))}
        classes={classes}
        media={media}
        seo={{
          title: seo?.title ?? '',
          description: seo?.description ?? '',
          ogImage: seo?.ogImage ?? '',
          robots: seo?.robots ?? 'INDEX_FOLLOW',
        }}
      />
    </>
  )
}
