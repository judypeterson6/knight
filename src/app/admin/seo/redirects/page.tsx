import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader, Panel } from '@/components/admin/ui'
import { RecordManager, type FieldDef, type RecordRow } from '@/components/admin/record-manager'
import { RedirectImport } from '@/components/admin/redirect-import'

export const dynamic = 'force-dynamic'

const FIELDS: FieldDef[] = [
  { name: 'from', label: 'From', type: 'text', required: true, inTable: true, help: 'Leading slash, no trailing slash. The old URL.' },
  { name: 'to', label: 'To', type: 'text', required: true, inTable: true, help: 'A path on this site, or a full URL.' },
  {
    name: 'kind',
    label: 'Type',
    type: 'select',
    inTable: true,
    options: [
      { value: 'PERMANENT', label: '301 permanent' },
      { value: 'TEMPORARY', label: '302 temporary' },
    ],
  },
  { name: 'enabled', label: 'Enabled', type: 'checkbox', inTable: true },
  { name: 'note', label: 'Note', type: 'text' },
]

export default async function RedirectsAdmin() {
  const gate = await requireRole('ADMIN')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const redirects = await prisma.redirect.findMany({ orderBy: { from: 'asc' } }).catch(() => [])
  const withHits = redirects.filter((r) => r.hits > 0).length

  return (
    <>
      <AdminPageHeader
        title="Redirects"
        description={`${redirects.length} rules, ${withHits} of which have been hit. Pre-populated by the WordPress migration — every URL that changed shape, plus the duplicate-topic consolidations.`}
      />

      <Panel title="Import and export" className="mb-8">
        <RedirectImport />
      </Panel>

      <RecordManager
        endpoint="/api/admin/redirects"
        fields={[...FIELDS, { name: 'hits', label: 'Hits', type: 'number', inTable: true }]}
        singular="Redirect"
        emptyBody="No redirects yet."
        records={redirects as unknown as RecordRow[]}
      />
    </>
  )
}
