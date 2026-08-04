import { prisma } from '@/lib/prisma'
import { createItemHandlers } from '@/lib/crud'
import { faqCreateSchema, faqUpdateSchema } from '@/lib/admin-schemas'
import { revalidateStructuredContent } from '@/lib/revalidate'

export const runtime = 'nodejs'

export const { GET, PATCH, DELETE } = createItemHandlers({
  delegate: () => prisma.faqItem,
  createSchema: faqCreateSchema,
  updateSchema: faqUpdateSchema,
  onChange: () => {
    revalidateStructuredContent()
  },
})
