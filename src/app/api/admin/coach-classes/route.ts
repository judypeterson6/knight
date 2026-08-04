import { prisma } from '@/lib/prisma'
import { createCollectionHandlers } from '@/lib/crud'
import { coachClassCreateSchema, coachClassUpdateSchema } from '@/lib/admin-schemas'
import { revalidateStructuredContent } from '@/lib/revalidate'

export const runtime = 'nodejs'

export const { GET, POST } = createCollectionHandlers({
  delegate: () => prisma.coachClass,
  createSchema: coachClassCreateSchema,
  updateSchema: coachClassUpdateSchema,
  listArgs: { orderBy: { order: 'asc' }, include: { _count: { select: { coaches: true } } } },
  onChange: () => {
    revalidateStructuredContent()
  },
})
