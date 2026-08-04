import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader, Badge, Cell, DataTable, EmptyState, Panel, Row } from '@/components/admin/ui'
import { RecordManager, type FieldDef, type RecordRow } from '@/components/admin/record-manager'
import { formatPrice } from '@/components/blocks/fleet'

export const dynamic = 'force-dynamic'

const CLASS_FIELDS: FieldDef[] = [
  { name: 'name', label: 'Class name', type: 'text', required: true, inTable: true },
  { name: 'slug', label: 'Slug', type: 'slug', required: true, slugFrom: 'name', inTable: true },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'order', label: 'Order', type: 'number', inTable: true },
]

export default async function FleetAdmin() {
  const gate = await requireRole('EDITOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const [coaches, classes] = await Promise.all([
    prisma.coach
      .findMany({
        orderBy: [{ featured: 'desc' }, { displayOrder: 'asc' }],
        include: { class: true, _count: { select: { images: true } } },
      })
      .catch(() => []),
    prisma.coachClass.findMany({ orderBy: { order: 'asc' } }).catch(() => []),
  ])

  const unpriced = coaches.filter((c) => c.dailyPrice === null).length

  return (
    <>
      <AdminPageHeader
        title="Fleet"
        description="Coaches are structured records, not prose. Class, chassis, bunk count, slide-out and rear configuration all render as crawlable text on the front end."
        actions={
          <Link href="/admin/fleet/new" className="kc-btn kc-btn-primary !px-5 !py-2.5">
            New coach
          </Link>
        }
      />

      {unpriced > 0 ? (
        <p className="mb-6 rounded-card border border-line bg-surface-alt p-4 text-step--1 text-muted">
          <strong className="text-ink">{unpriced}</strong> of {coaches.length} coaches have no daily rate set, so they
          display as &ldquo;quoted per tour&rdquo;, their Product schema omits the offer price, and the price filter is
          hidden on /fleet. Set real rates here to activate all three — the migration deliberately did not invent them.
        </p>
      ) : null}

      {coaches.length === 0 ? (
        <EmptyState title="No coaches yet" body="Add the first coach, or run the migration and seed." />
      ) : (
        <DataTable head={['Name', 'Class', 'Chassis', 'Bunks', 'Slides', 'Rear', 'Rate', 'Images', 'Status', '']}>
          {coaches.map((coach) => (
            <Row key={coach.id}>
              <Cell>
                <Link href={`/admin/fleet/${coach.id}`} className="font-bold text-primary hover:underline">
                  {coach.name}
                </Link>
                {coach.featured ? <span className="ml-2 text-[0.68rem] font-bold uppercase text-subtle">featured</span> : null}
              </Cell>
              <Cell className="text-muted">{coach.class?.name ?? '—'}</Cell>
              <Cell className="text-muted">{coach.chassis}</Cell>
              <Cell>{coach.bunks}</Cell>
              <Cell className="text-muted">{coach.slideOuts}</Cell>
              <Cell className="text-muted">{coach.rearConfig}</Cell>
              <Cell>{formatPrice(coach.dailyPrice, coach.currency) ?? 'Quoted'}</Cell>
              <Cell>{coach._count.images}</Cell>
              <Cell>
                <Badge>{coach.status}</Badge>
              </Cell>
              <Cell>
                <div className="flex gap-3">
                  <Link href={`/admin/fleet/${coach.id}`} className="font-bold text-primary hover:underline">
                    Edit
                  </Link>
                  <Link href={`/fleet/${coach.slug}`} className="font-bold text-muted hover:text-primary hover:underline">
                    View
                  </Link>
                </div>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}

      <Panel title="Coach classes" description="The class taxonomy that drives the /fleet filter and the comparison table." className="mt-10">
        <RecordManager
          endpoint="/api/admin/coach-classes"
          fields={CLASS_FIELDS}
          singular="Class"
          emptyBody="No classes yet."
          records={classes as unknown as RecordRow[]}
        />
      </Panel>
    </>
  )
}
