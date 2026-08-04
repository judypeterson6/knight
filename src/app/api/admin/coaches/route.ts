import { prisma } from '@/lib/prisma'
import { createCollectionHandlers } from '@/lib/crud'
import { coachCreateSchema, coachUpdateSchema } from '@/lib/admin-schemas'
import { revalidateCoach, revalidateStructuredContent } from '@/lib/revalidate'

export const runtime = 'nodejs'

export const { GET, POST } = createCollectionHandlers({
  delegate: () => prisma.coach,
  createSchema: coachCreateSchema,
  updateSchema: coachUpdateSchema,
  listArgs: {
    orderBy: [{ featured: 'desc' }, { displayOrder: 'asc' }],
    include: { class: true, images: { orderBy: { order: 'asc' }, take: 1, include: { media: true } } },
  },
  transform: (data, action) => ({
    ...data,
    ...(action === 'create' && data.status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
  }),
  onChange: async (record) => {
    await revalidateCoach(String(record.slug))
    revalidateStructuredContent()
  },
})
