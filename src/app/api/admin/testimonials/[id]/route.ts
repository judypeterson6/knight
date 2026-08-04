import { prisma } from '@/lib/prisma'
import { createItemHandlers } from '@/lib/crud'
import { testimonialCreateSchema, testimonialUpdateSchema } from '@/lib/admin-schemas'
import { revalidateStructuredContent } from '@/lib/revalidate'

export const runtime = 'nodejs'

export const { GET, PATCH, DELETE } = createItemHandlers({
  delegate: () => prisma.testimonial,
  createSchema: testimonialCreateSchema,
  updateSchema: testimonialUpdateSchema,
  onChange: () => {
    revalidateStructuredContent()
  },
})
