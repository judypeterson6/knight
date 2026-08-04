import { prisma } from '@/lib/prisma'
import { createItemHandlers } from '@/lib/crud'
import { coachClassCreateSchema, coachClassUpdateSchema } from '@/lib/admin-schemas'
import { revalidateStructuredContent } from '@/lib/revalidate'

export const runtime = 'nodejs'

export const { GET, PATCH, DELETE } = createItemHandlers({
  delegate: () => prisma.coachClass,
  createSchema: coachClassCreateSchema,
  updateSchema: coachClassUpdateSchema,
  onChange: () => {
    revalidateStructuredContent()
  },
})
