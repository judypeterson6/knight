import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader } from '@/components/admin/ui'
import { RecordManager, type FieldDef, type RecordRow } from '@/components/admin/record-manager'

export const dynamic = 'force-dynamic'

export default async function LocationsAdmin() {
  const gate = await requireRole('EDITOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const [locations, media] = await Promise.all([
    prisma.location.findMany({ orderBy: [{ isHub: 'desc' }, { order: 'asc' }] }).catch(() => []),
    prisma.media.findMany({ orderBy: { createdAt: 'desc' }, take: 300, select: { id: true, filename: true } }).catch(() => []),
  ])

  const fields: FieldDef[] = [
    { name: 'city', label: 'City', type: 'text', required: true, inTable: true },
    { name: 'state', label: 'State', type: 'text', inTable: true },
    { name: 'slug', label: 'Slug', type: 'slug', required: true, slugFrom: 'city' },
    { name: 'path', label: 'Page path', type: 'text', inTable: true, help: 'e.g. /tour-bus-rental/atlanta-ga. Leave blank if this city has no page of its own — it will then be excluded from the destination grid.' },
    { name: 'region', label: 'Region', type: 'text' },
    { name: 'summary', label: 'Summary', type: 'textarea' },
    { name: 'imageId', label: 'Image', type: 'select', options: media.map((m) => ({ value: m.id, label: m.filename })) },
    { name: 'isHub', label: 'Positioning hub', type: 'checkbox', inTable: true },
    { name: 'isPrimary', label: 'Primary market', type: 'checkbox' },
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
        title="Locations"
        description="City records power the destination grid and the coverage market list. Every card and link points at a real page — a location with no path is not linked."
      />
      <RecordManager
        endpoint="/api/admin/locations"
        fields={fields}
        singular="Location"
        emptyBody="No locations yet."
        records={locations as unknown as RecordRow[]}
      />
    </>
  )
}
