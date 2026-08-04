import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader } from '@/components/admin/ui'
import { RecordManager, type FieldDef, type RecordRow } from '@/components/admin/record-manager'

export const dynamic = 'force-dynamic'

export default async function TestimonialsAdmin() {
  const gate = await requireRole('EDITOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const [testimonials, media] = await Promise.all([
    prisma.testimonial.findMany({ orderBy: { order: 'asc' } }).catch(() => []),
    prisma.media.findMany({ orderBy: { createdAt: 'desc' }, take: 300, select: { id: true, filename: true } }).catch(() => []),
  ])

  const fields: FieldDef[] = [
    { name: 'name', label: 'Name', type: 'text', required: true, inTable: true },
    { name: 'slug', label: 'Slug', type: 'slug', required: true, slugFrom: 'name' },
    { name: 'role', label: 'Role', type: 'text', required: true, inTable: true },
    { name: 'quote', label: 'Quote', type: 'textarea', required: true },
    { name: 'rating', label: 'Rating (1–5)', type: 'number', inTable: true },
    {
      name: 'avatarId',
      label: 'Avatar',
      type: 'select',
      options: media.map((m) => ({ value: m.id, label: m.filename })),
    },
    { name: 'order', label: 'Order', type: 'number' },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      inTable: true,
      options: ['PUBLISHED', 'DRAFT', 'ARCHIVED'].map((s) => ({ value: s, label: s })),
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="Testimonials"
        description="Name, role and rating all render as crawlable text. Reviews are nested on the Organization schema only where a real named review exists — no AggregateRating is ever synthesised from them."
      />
      <RecordManager
        endpoint="/api/admin/testimonials"
        fields={fields}
        singular="Testimonial"
        emptyBody="No testimonials yet."
        records={testimonials as unknown as RecordRow[]}
      />
    </>
  )
}
