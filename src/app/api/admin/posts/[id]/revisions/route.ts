import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { revalidatePost } from '@/lib/revalidate'

export const runtime = 'nodejs'

const restoreSchema = z.object({ revisionId: z.string().min(1) })

/** Revision history for a post. A snapshot is written on every save. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await guard('AUTHOR')
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const revisions = await prisma.postRevision
    .findMany({
      where: { postId: id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { author: { select: { name: true } } },
    })
    .catch(() => [])

  return ok(
    revisions.map((r) => {
      const snapshot = r.snapshot as { title?: string; body?: string; status?: string }
      return {
        id: r.id,
        note: r.note,
        author: r.author?.name ?? 'Unknown',
        createdAt: r.createdAt,
        title: snapshot.title ?? '',
        status: snapshot.status ?? '',
        words: (snapshot.body ?? '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length,
      }
    }),
  )
}

/** Restores a revision, snapshotting the current state first so it is undoable. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await auth()
  if (!session?.user) return fail('Not signed in', 401)

  const { id } = await ctx.params

  const [post, body] = await Promise.all([
    prisma.post.findUnique({ where: { id } }),
    parseBody(request, restoreSchema),
  ])
  if (!post) return fail('Post not found', 404)
  if (!body.ok) return body.response

  // AUTHORs may only restore their own posts; EDITOR and above, any post.
  if (session.user.role === 'AUTHOR' && post.authorId !== session.user.id) {
    return fail('You can only restore your own posts', 403)
  }

  const revision = await prisma.postRevision.findUnique({ where: { id: body.data.revisionId } })
  if (!revision || revision.postId !== post.id) return fail('Revision not found', 404)

  const snapshot = revision.snapshot as {
    title?: string
    excerpt?: string | null
    body?: string
    status?: string
    categoryId?: string | null
  }

  await prisma.postRevision.create({
    data: {
      postId: post.id,
      authorId: session.user.id,
      note: `Auto-snapshot before restoring revision ${revision.id}`,
      snapshot: {
        title: post.title,
        excerpt: post.excerpt,
        body: post.body,
        status: post.status,
        categoryId: post.categoryId,
      },
    },
  })

  const restored = await prisma.post.update({
    where: { id: post.id },
    data: {
      title: snapshot.title ?? post.title,
      excerpt: snapshot.excerpt ?? post.excerpt,
      body: snapshot.body ?? post.body,
      categoryId: snapshot.categoryId ?? post.categoryId,
    },
  })

  if (restored.status === 'PUBLISHED') await revalidatePost(restored.slug)
  return ok({ id: restored.id, title: restored.title })
}
