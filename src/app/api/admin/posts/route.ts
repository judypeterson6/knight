import { prisma } from '@/lib/prisma'
import { createCollectionHandlers } from '@/lib/crud'
import { postCreateSchema, postUpdateSchema } from '@/lib/admin-schemas'
import { revalidatePost } from '@/lib/revalidate'

export const runtime = 'nodejs'

export const { GET, POST } = createCollectionHandlers({
  delegate: () => prisma.post,
  createSchema: postCreateSchema,
  updateSchema: postUpdateSchema,
  readRole: 'AUTHOR',
  writeRole: 'AUTHOR',
  listArgs: {
    orderBy: { updatedAt: 'desc' },
    include: { author: { select: { name: true } }, category: { select: { name: true, slug: true } } },
  },
  transform: (data, action) => ({
    ...data,
    ...(data.publishedAt ? { publishedAt: new Date(String(data.publishedAt)) } : {}),
    ...(action === 'create' && data.status === 'PUBLISHED' && !data.publishedAt ? { publishedAt: new Date() } : {}),
  }),
  onChange: async (record) => {
    if (record.status === 'PUBLISHED') await revalidatePost(String(record.slug))
  },
})
