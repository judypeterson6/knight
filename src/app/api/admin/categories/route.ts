import { prisma } from '@/lib/prisma'
import { createCollectionHandlers } from '@/lib/crud'
import { categoryCreateSchema, categoryUpdateSchema } from '@/lib/admin-schemas'
import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'

export const { GET, POST } = createCollectionHandlers({
  delegate: () => prisma.category,
  createSchema: categoryCreateSchema,
  updateSchema: categoryUpdateSchema,
  listArgs: { orderBy: { order: 'asc' }, include: { _count: { select: { posts: true } } } },
  onChange: () => {
    revalidatePath('/blog')
  },
})
