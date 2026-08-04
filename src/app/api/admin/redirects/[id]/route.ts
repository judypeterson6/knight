import { prisma } from '@/lib/prisma'
import { createItemHandlers } from '@/lib/crud'
import { redirectCreateSchema, redirectUpdateSchema } from '@/lib/admin-schemas'
import { revalidateRedirects } from '@/lib/revalidate'

export const runtime = 'nodejs'

export const { GET, PATCH, DELETE } = createItemHandlers({
  delegate: () => prisma.redirect,
  createSchema: redirectCreateSchema,
  updateSchema: redirectUpdateSchema,
  writeRole: 'ADMIN',
  onChange: () => {
    revalidateRedirects()
  },
})
