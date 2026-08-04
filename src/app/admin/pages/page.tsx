import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { formatDate } from '@/lib/utils'
import { AdminPageHeader, Badge, Cell, DataTable, EmptyState, Row } from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function PagesList() {
  const gate = await requireRole('EDITOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const pages = await prisma.page
    .findMany({ orderBy: { path: 'asc' }, include: { _count: { select: { blocks: true } } } })
    .catch(() => [])

  return (
    <>
      <AdminPageHeader
        title="Pages"
        description="Every page is an ordered list of typed blocks. Open the builder to add, reorder, hide or edit them."
        actions={
          <Link href="/admin/pages/new" className="kc-btn kc-btn-primary !px-5 !py-2.5">
            New page
          </Link>
        }
      />

      {pages.length === 0 ? (
        <EmptyState
          title="No pages yet"
          body="Run the WordPress migration and seed to import the live site, or create a page from scratch."
        />
      ) : (
        <DataTable head={['Title', 'Path', 'Type', 'Blocks', 'Status', 'Updated', '']}>
          {pages.map((page) => (
            <Row key={page.id}>
              <Cell>
                <Link href={`/admin/pages/${page.id}/edit`} className="font-bold text-primary hover:underline">
                  {page.title}
                </Link>
              </Cell>
              <Cell className="font-mono text-step--1 text-muted">{page.path}</Cell>
              <Cell className="text-muted">{page.pageType}</Cell>
              <Cell>{page._count.blocks}</Cell>
              <Cell>
                <Badge>{page.status}</Badge>
              </Cell>
              <Cell className="text-muted">{formatDate(page.updatedAt)}</Cell>
              <Cell>
                <div className="flex gap-3">
                  <Link href={`/admin/pages/${page.id}/edit`} className="font-bold text-primary hover:underline">
                    Edit
                  </Link>
                  <Link href={page.path} className="font-bold text-muted hover:text-primary hover:underline">
                    View
                  </Link>
                </div>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </>
  )
}
