import { prisma } from '@/lib/prisma'
import { createCollectionHandlers } from '@/lib/crud'
import { faqCreateSchema, faqUpdateSchema } from '@/lib/admin-schemas'
import { revalidateStructuredContent } from '@/lib/revalidate'

export const runtime = 'nodejs'

export const { GET, POST } = createCollectionHandlers({
  delegate: () => prisma.faqItem,
  createSchema: faqCreateSchema,
  updateSchema: faqUpdateSchema,
  listArgs: { orderBy: [{ group: 'asc' }, { order: 'asc' }] },
  onChange: () => {
    revalidateStructuredContent()
  },
})
