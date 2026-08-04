import { prisma } from '@/lib/prisma'
import { createItemHandlers } from '@/lib/crud'
import { pageCreateSchema, pageUpdateSchema } from '@/lib/admin-schemas'
import { revalidatePageRoute } from '@/lib/revalidate'

export const runtime = 'nodejs'

export const { GET, PATCH, DELETE } = createItemHandlers({
  delegate: () => prisma.page,
  createSchema: pageCreateSchema,
  updateSchema: pageUpdateSchema,
  writeRole: 'EDITOR',
  singleArgs: { include: { blocks: { orderBy: { order: 'asc' } }, heroImage: true } },
  transform: (data) => ({
    ...data,
    ...(data.status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
    ...(data.publishedAt ? { publishedAt: new Date(String(data.publishedAt)) } : {}),
  }),
  onChange: async (record, action) => {
    await revalidatePageRoute(String(record.path), action === 'delete' ? 'URL_DELETED' : 'URL_UPDATED')
  },
})
