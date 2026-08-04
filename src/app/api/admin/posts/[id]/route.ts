import { prisma } from '@/lib/prisma'
import { createItemHandlers } from '@/lib/crud'
import { postCreateSchema, postUpdateSchema } from '@/lib/admin-schemas'
import { revalidatePost } from '@/lib/revalidate'
import { auth } from '@/lib/auth'

export const runtime = 'nodejs'

const handlers = createItemHandlers({
  delegate: () => prisma.post,
  createSchema: postCreateSchema,
  updateSchema: postUpdateSchema,
  readRole: 'AUTHOR',
  writeRole: 'AUTHOR',
  singleArgs: { include: { author: true, category: true, featuredImage: true } },
  transform: (data) => ({
    ...data,
    ...(data.publishedAt ? { publishedAt: new Date(String(data.publishedAt)) } : {}),
    ...(data.status === 'PUBLISHED' && !data.publishedAt ? { publishedAt: new Date() } : {}),
  }),
  onChange: async (record, action) => {
    await revalidatePost(String(record.slug), action === 'delete' ? 'URL_DELETED' : 'URL_UPDATED')
  },
})

export const { GET, DELETE } = handlers

/**
 * AUTHORs may only edit their own posts; EDITOR and above may edit any. This is
 * the ownership check the generic factory cannot express, so it wraps PATCH.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await auth()
  if (!session?.user) return Response.json({ ok: false, error: 'Not signed in' }, { status: 401 })

  if (session.user.role === 'AUTHOR') {
    const { id } = await ctx.params
    const post = await prisma.post.findUnique({ where: { id }, select: { authorId: true } })
    if (!post) return Response.json({ ok: false, error: 'Not found' }, { status: 404 })
    if (post.authorId !== session.user.id) {
      return Response.json({ ok: false, error: 'You can only edit your own posts' }, { status: 403 })
    }
  }

  // Snapshot before the write so post revisions are restorable.
  const { id } = await ctx.params
  const current = await prisma.post.findUnique({ where: { id } })
  if (current) {
    await prisma.postRevision
      .create({
        data: {
          postId: current.id,
          authorId: session.user.id,
          snapshot: {
            title: current.title,
            excerpt: current.excerpt,
            body: current.body,
            status: current.status,
            categoryId: current.categoryId,
          },
        },
      })
      .catch(() => undefined)
  }

  return handlers.PATCH(request, ctx)
}
