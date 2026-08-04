import { prisma } from '@/lib/prisma'
import { createCollectionHandlers } from '@/lib/crud'
import { testimonialCreateSchema, testimonialUpdateSchema } from '@/lib/admin-schemas'
import { revalidateStructuredContent } from '@/lib/revalidate'

export const runtime = 'nodejs'

export const { GET, POST } = createCollectionHandlers({
  delegate: () => prisma.testimonial,
  createSchema: testimonialCreateSchema,
  updateSchema: testimonialUpdateSchema,
  listArgs: { orderBy: { order: 'asc' }, include: { avatar: true } },
  onChange: () => {
    revalidateStructuredContent()
  },
})
