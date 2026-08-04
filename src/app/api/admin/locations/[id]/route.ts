import { prisma } from '@/lib/prisma'
import { createItemHandlers } from '@/lib/crud'
import { locationCreateSchema, locationUpdateSchema } from '@/lib/admin-schemas'
import { revalidateStructuredContent } from '@/lib/revalidate'

export const runtime = 'nodejs'

export const { GET, PATCH, DELETE } = createItemHandlers({
  delegate: () => prisma.location,
  createSchema: locationCreateSchema,
  updateSchema: locationUpdateSchema,
  onChange: () => {
    revalidateStructuredContent()
  },
})
