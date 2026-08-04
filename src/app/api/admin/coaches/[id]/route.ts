import { prisma } from '@/lib/prisma'
import { createItemHandlers } from '@/lib/crud'
import { coachCreateSchema, coachUpdateSchema } from '@/lib/admin-schemas'
import { revalidateCoach, revalidateStructuredContent } from '@/lib/revalidate'

export const runtime = 'nodejs'

export const { GET, PATCH, DELETE } = createItemHandlers({
  delegate: () => prisma.coach,
  createSchema: coachCreateSchema,
  updateSchema: coachUpdateSchema,
  singleArgs: { include: { class: true, images: { orderBy: { order: 'asc' }, include: { media: true } } } },
  transform: (data) => ({
    ...data,
    ...(data.status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
  }),
  onChange: async (record, action) => {
    await revalidateCoach(String(record.slug), action === 'delete' ? 'URL_DELETED' : 'URL_UPDATED')
    revalidateStructuredContent()
  },
})
