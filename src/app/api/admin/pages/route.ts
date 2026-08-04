import { prisma } from '@/lib/prisma'
import { createCollectionHandlers } from '@/lib/crud'
import { pageCreateSchema, pageUpdateSchema } from '@/lib/admin-schemas'
import { revalidatePageRoute } from '@/lib/revalidate'

export const runtime = 'nodejs'

export const { GET, POST } = createCollectionHandlers({
  delegate: () => prisma.page,
  createSchema: pageCreateSchema,
  updateSchema: pageUpdateSchema,
  writeRole: 'EDITOR',
  listArgs: { orderBy: { path: 'asc' }, include: { _count: { select: { blocks: true } } } },
  transform: (data, action) => ({
    ...data,
    ...(action === 'create' && data.status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
  }),
  onChange: async (record) => {
    await revalidatePageRoute(String(record.path))
  },
})
