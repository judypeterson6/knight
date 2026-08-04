import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader } from '@/components/admin/ui'
import { RecordManager, type FieldDef, type RecordRow } from '@/components/admin/record-manager'

export const dynamic = 'force-dynamic'

const FIELDS: FieldDef[] = [
  { name: 'question', label: 'Question', type: 'text', required: true, inTable: true },
  { name: 'slug', label: 'Slug', type: 'slug', required: true, slugFrom: 'question' },
  { name: 'answer', label: 'Answer', type: 'textarea', required: true, help: 'Ships in the initial HTML — never injected on click.' },
  {
    name: 'group',
    label: 'Group',
    type: 'select',
    required: true,
    inTable: true,
    options: ['home', 'entertainer-coach', 'tour-bus-rental', 'nationwide', 'fleet'].map((g) => ({ value: g, label: g })),
    help: 'Which page stack this FAQ appears on. Must match the FAQ block’s group.',
  },
  { name: 'order', label: 'Order', type: 'number', inTable: true },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    inTable: true,
    options: ['PUBLISHED', 'DRAFT', 'ARCHIVED'].map((s) => ({ value: s, label: s })),
  },
]

export default async function FaqsAdmin() {
  const gate = await requireRole('EDITOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const faqs = await prisma.faqItem.findMany({ orderBy: [{ group: 'asc' }, { order: 'asc' }] }).catch(() => [])

  return (
    <>
      <AdminPageHeader
        title="FAQs"
        description="FAQ answers are rendered into the initial HTML and feed the FAQPage structured data from the same rows, so the two can never drift apart."
      />
      <RecordManager
        endpoint="/api/admin/faqs"
        fields={FIELDS}
        singular="FAQ"
        emptyBody="No FAQ items yet."
        records={faqs as unknown as RecordRow[]}
      />
    </>
  )
}
