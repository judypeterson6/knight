import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { mediaUpdateSchema } from '@/lib/admin-schemas'
import { revalidateStructuredContent } from '@/lib/revalidate'

export const runtime = 'nodejs'

/**
 * Every place an asset is referenced.
 *
 * Block props are JSON, so usage inside a page is found by searching the JSON
 * for the asset path rather than by a foreign key.
 */
async function usagesOf(mediaId: string, mediaPath: string) {
  const [coaches, posts, pages, testimonials, locations, users, blocks] = await Promise.all([
    prisma.coachImage.findMany({ where: { mediaId }, include: { coach: { select: { name: true, slug: true } } } }),
    prisma.post.findMany({ where: { featuredImageId: mediaId }, select: { title: true, slug: true } }),
    prisma.page.findMany({ where: { heroImageId: mediaId }, select: { title: true, path: true } }),
    prisma.testimonial.findMany({ where: { avatarId: mediaId }, select: { name: true, slug: true } }),
    prisma.location.findMany({ where: { imageId: mediaId }, select: { city: true, slug: true } }),
    prisma.user.findMany({ where: { avatarId: mediaId }, select: { name: true, id: true } }),
    prisma.$queryRaw<{ id: string; title: string; path: string }[]>`
      SELECT p.id, p.title, p.path
      FROM PageBlock b
      JOIN Page p ON p.id = b.pageId
      WHERE JSON_SEARCH(b.props, 'one', ${mediaPath}) IS NOT NULL
      GROUP BY p.id, p.title, p.path
    `.catch(() => []),
  ])

  return [
    ...coaches.map((c) => ({ kind: 'Coach gallery', label: c.coach.name, href: `/admin/fleet/${c.coachId}` })),
    ...posts.map((p) => ({ kind: 'Post featured image', label: p.title, href: `/blog/${p.slug}` })),
    ...pages.map((p) => ({ kind: 'Page hero', label: p.title, href: p.path })),
    ...blocks.map((p) => ({ kind: 'Page block', label: p.title, href: p.path })),
    ...testimonials.map((t) => ({ kind: 'Testimonial avatar', label: t.name, href: '/admin/testimonials' })),
    ...locations.map((l) => ({ kind: 'Location image', label: l.city, href: '/admin/locations' })),
    ...users.map((u) => ({ kind: 'User avatar', label: u.name, href: `/admin/users/${u.id}` })),
  ]
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await guard('AUTHOR')
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const media = await prisma.media.findUnique({ where: { id } })
  if (!media) return fail('Not found', 404)

  return ok({ ...media, usages: await usagesOf(media.id, media.path) })
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await guard('AUTHOR')
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const body = await parseBody(request, mediaUpdateSchema)
  if (!body.ok) return body.response

  const media = await prisma.media.update({
    where: { id },
    data: {
      alt: body.data.decorative ? '' : body.data.alt,
      decorative: body.data.decorative,
      title: body.data.title ?? null,
      caption: body.data.caption ?? null,
    },
  })
  revalidateStructuredContent()
  return ok(media)
}

/**
 * Deleting an asset that is still in use is blocked, with an explicit
 * ?force=true override for when the operator knows better.
 */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await guard('EDITOR')
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const force = new URL(request.url).searchParams.get('force') === 'true'

  const media = await prisma.media.findUnique({ where: { id } })
  if (!media) return fail('Not found', 404)

  const usages = await usagesOf(media.id, media.path)
  if (usages.length && !force) {
    return fail(
      `${media.filename} is used in ${usages.length} place(s). Remove it there first, or delete with the override.`,
      409,
      usages,
    )
  }

  await prisma.media.delete({ where: { id } })
  await unlink(path.join(process.cwd(), 'public', media.path.replace(/^\//, ''))).catch(() => undefined)

  revalidateStructuredContent()
  return ok({ id, removedUsages: usages.length })
}
