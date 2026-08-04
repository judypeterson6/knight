import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader } from '@/components/admin/ui'
import { RecordManager, type FieldDef, type RecordRow } from '@/components/admin/record-manager'

export const dynamic = 'force-dynamic'

export default async function CategoriesAdmin() {
  const gate = await requireRole('EDITOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const categories = await prisma.category
    .findMany({ orderBy: { order: 'asc' }, include: { _count: { select: { posts: true } } } })
    .catch(() => [])

  const fields: FieldDef[] = [
    { name: 'name', label: 'Name', type: 'text', required: true, inTable: true },
    { name: 'slug', label: 'Slug', type: 'slug', required: true, slugFrom: 'name', inTable: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    {
      name: 'parentId',
      label: 'Parent category',
      type: 'select',
      options: categories.map((c) => ({ value: c.id, label: c.name })),
      help: 'Categories nest. There is no tag system anywhere on this site.',
    },
    { name: 'order', label: 'Order', type: 'number', inTable: true },
  ]

  return (
    <>
      <AdminPageHeader title="Categories" description="Blog taxonomy. Categories only — no tags." />
      <RecordManager
        endpoint="/api/admin/categories"
        fields={fields}
        singular="Category"
        emptyBody="No categories yet."
        records={categories as unknown as RecordRow[]}
      />
    </>
  )
}
