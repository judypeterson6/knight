import { prisma } from '@/lib/prisma'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { coachImagesSchema } from '@/lib/admin-schemas'
import { revalidateCoach } from '@/lib/revalidate'

export const runtime = 'nodejs'

/**
 * Replaces a coach's ordered gallery.
 *
 * Every referenced Media row must already carry alt text (or be flagged
 * decorative) — the same gate the block API applies, enforced here so an image
 * cannot reach a coach page unlabelled.
 */
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await guard('EDITOR')
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const body = await parseBody(request, coachImagesSchema)
  if (!body.ok) return body.response

  const coach = await prisma.coach.findUnique({ where: { id }, select: { id: true, slug: true } })
  if (!coach) return fail('Coach not found', 404)

  const mediaIds = body.data.images.map((i) => i.mediaId)
  const media = await prisma.media.findMany({
    where: { id: { in: mediaIds } },
    select: { id: true, alt: true, decorative: true, filename: true },
  })

  const missing = mediaIds.filter((mid) => !media.some((m) => m.id === mid))
  if (missing.length) return fail(`Unknown media: ${missing.join(', ')}`, 422)

  const unlabelled = media.filter((m) => !m.alt.trim() && !m.decorative)
  if (unlabelled.length) {
    return fail(
      `${unlabelled[0].filename} has no alt text. Add alt text in the media library, or mark it decorative.`,
      422,
      unlabelled.map((m) => m.filename),
    )
  }

  await prisma.$transaction([
    prisma.coachImage.deleteMany({ where: { coachId: coach.id } }),
    prisma.coachImage.createMany({
      data: body.data.images.map((i) => ({
        coachId: coach.id,
        mediaId: i.mediaId,
        order: i.order,
        caption: i.caption,
      })),
    }),
  ])

  await revalidateCoach(coach.slug)
  return ok({ count: body.data.images.length })
}
