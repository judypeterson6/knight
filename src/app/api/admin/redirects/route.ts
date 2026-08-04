import { prisma } from '@/lib/prisma'
import { createCollectionHandlers } from '@/lib/crud'
import { redirectCreateSchema, redirectUpdateSchema } from '@/lib/admin-schemas'
import { revalidateRedirects } from '@/lib/revalidate'

export const runtime = 'nodejs'

export const { GET, POST } = createCollectionHandlers({
  delegate: () => prisma.redirect,
  createSchema: redirectCreateSchema,
  updateSchema: redirectUpdateSchema,
  writeRole: 'ADMIN',
  listArgs: { orderBy: { from: 'asc' } },
  onChange: () => {
    revalidateRedirects()
  },
})
