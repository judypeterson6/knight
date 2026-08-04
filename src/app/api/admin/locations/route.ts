import { prisma } from '@/lib/prisma'
import { createCollectionHandlers } from '@/lib/crud'
import { locationCreateSchema, locationUpdateSchema } from '@/lib/admin-schemas'
import { revalidateStructuredContent } from '@/lib/revalidate'

export const runtime = 'nodejs'

export const { GET, POST } = createCollectionHandlers({
  delegate: () => prisma.location,
  createSchema: locationCreateSchema,
  updateSchema: locationUpdateSchema,
  listArgs: { orderBy: [{ isHub: 'desc' }, { order: 'asc' }], include: { image: true } },
  onChange: () => {
    revalidateStructuredContent()
  },
})
