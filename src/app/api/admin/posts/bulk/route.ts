import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { fail, ok, parseBody } from '@/lib/api'
import { postBulkSchema } from '@/lib/admin-schemas'
import { revalidatePost } from '@/lib/revalidate'

export const runtime = 'nodejs'

/**
 * Bulk actions over selected posts.
 *
 * AUTHORs may only act on their own posts — the selection is narrowed to what
 * they own server-side rather than rejected, so a mixed selection does the
 * permitted part and reports the rest.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth()
  if (!session?.user) return fail('Not signed in', 401)

  const body = await parseBody(request, postBulkSchema)
  if (!body.ok) return body.response

  const { ids, action, categoryId } = body.data

  const posts = await prisma.post.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, authorId: true, status: true },
  })

  const permitted =
    session.user.role === 'AUTHOR' ? posts.filter((p) => p.authorId === session.user.id) : posts
  const skipped = posts.length - permitted.length

  if (!permitted.length) {
    return fail(
      skipped ? 'You can only act on your own posts.' : 'None of the selected posts still exist.',
      403,
    )
  }

  const targetIds = permitted.map((p) => p.id)

  if (action === 'delete') {
    if (session.user.role === 'AUTHOR') return fail('Only an editor or admin can delete posts.', 403)
    await prisma.post.deleteMany({ where: { id: { in: targetIds } } })
    for (const post of permitted) {
      if (post.status === 'PUBLISHED') await revalidatePost(post.slug, 'URL_DELETED')
    }
    return ok({ affected: targetIds.length, skipped, action })
  }

  if (action === 'setCategory') {
    await prisma.post.updateMany({ where: { id: { in: targetIds } }, data: { categoryId: categoryId ?? null } })
    for (const post of permitted) {
      if (post.status === 'PUBLISHED') await revalidatePost(post.slug)
    }
    return ok({ affected: targetIds.length, skipped, action })
  }

  const status = action === 'publish' ? 'PUBLISHED' : action === 'draft' ? 'DRAFT' : 'ARCHIVED'

  await prisma.post.updateMany({
    where: { id: { in: targetIds } },
    // Publishing a post that has never been published stamps publishedAt; an
    // already-dated post keeps its original date.
    data: { status, ...(status === 'PUBLISHED' ? {} : {}) },
  })

  if (status === 'PUBLISHED') {
    await prisma.post.updateMany({
      where: { id: { in: targetIds }, publishedAt: null },
      data: { publishedAt: new Date() },
    })
  }

  for (const post of permitted) {
    await revalidatePost(post.slug, status === 'PUBLISHED' ? 'URL_UPDATED' : 'URL_DELETED')
  }

  return ok({ affected: targetIds.length, skipped, action })
}
