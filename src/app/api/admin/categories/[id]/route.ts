import { prisma } from '@/lib/prisma'
import { createItemHandlers } from '@/lib/crud'
import { categoryCreateSchema, categoryUpdateSchema } from '@/lib/admin-schemas'
import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'

export const { GET, PATCH, DELETE } = createItemHandlers({
  delegate: () => prisma.category,
  createSchema: categoryCreateSchema,
  updateSchema: categoryUpdateSchema,
  onChange: () => {
    revalidatePath('/guides')
  },
})
