import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { formatDate } from '@/lib/utils'
import { AdminPageHeader, Badge, Cell, DataTable, EmptyState, Panel, Row, StatCard } from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

/** Dashboard: counts, unread enquiries, recent quote requests, indexing, quick actions. */
export default async function AdminDashboard() {
  const gate = await requireRole('AUTHOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const [pages, posts, coaches, media, unread, submissions, indexing] = await Promise.all([
    prisma.page.count().catch(() => 0),
    prisma.post.count().catch(() => 0),
    prisma.coach.count().catch(() => 0),
    prisma.media.count().catch(() => 0),
    prisma.contactMessage.count({ where: { read: false } }).catch(() => 0),
    prisma.formSubmission
      .findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { form: true } })
      .catch(() => []),
    prisma.indexingLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }).catch(() => []),
  ])

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description="Content counts, recent enquiries and the last indexing submissions."
        actions={
          <>
            <Link href="/admin/pages" className="kc-btn kc-btn-outline !px-5 !py-2.5">
              Edit pages
            </Link>
            <Link href="/admin/posts/new" className="kc-btn kc-btn-primary !px-5 !py-2.5">
              New post
            </Link>
          </>
        }
      />

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Pages" value={pages} href="/admin/pages" />
        <StatCard label="Posts" value={posts} href="/admin/posts" />
        <StatCard label="Coaches" value={coaches} href="/admin/fleet" />
        <StatCard label="Media" value={media} href="/admin/media" />
        <StatCard label="Unread enquiries" value={unread} href="/admin/inbox" />
      </dl>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Panel
          title="Recent quote requests"
          description="Stored in MySQL whether or not the notification email was delivered."
          actions={
            <Link href="/admin/inbox" className="text-step--1 font-bold text-primary hover:underline">
              Inbox →
            </Link>
          }
        >
          {submissions.length === 0 ? (
            <EmptyState title="No submissions yet" body="Quote requests will appear here as they come in." />
          ) : (
            <DataTable head={['Form', 'Received', 'Email delivery']}>
              {submissions.map((submission) => (
                <Row key={submission.id}>
                  <Cell>
                    <Link href="/admin/inbox" className="font-bold text-primary hover:underline">
                      {submission.form.name}
                    </Link>
                  </Cell>
                  <Cell className="text-muted">{formatDate(submission.createdAt)}</Cell>
                  <Cell>
                    <Badge tone={submission.emailed ? 'PUBLISHED' : 'ARCHIVED'}>
                      {submission.emailed ? 'Sent' : 'Not sent'}
                    </Badge>
                  </Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </Panel>

        <Panel
          title="Last indexing submissions"
          description="IndexNow, Google Indexing API and sitemap pings."
          actions={
            <Link href="/admin/seo/indexing" className="text-step--1 font-bold text-primary hover:underline">
              Indexing →
            </Link>
          }
        >
          {indexing.length === 0 ? (
            <EmptyState
              title="Nothing submitted yet"
              body="URLs are submitted automatically when you publish, and can be submitted manually from any page, post or coach."
            />
          ) : (
            <DataTable head={['URL', 'Provider', 'Status']}>
              {indexing.map((log) => (
                <Row key={log.id}>
                  <Cell className="max-w-[18rem] truncate text-muted">{log.url}</Cell>
                  <Cell>{log.provider}</Cell>
                  <Cell>
                    <Badge tone={log.status === 'SUCCESS' ? 'PUBLISHED' : 'ARCHIVED'}>{log.status}</Badge>
                  </Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </Panel>
      </div>

      <Panel title="Quick actions" className="mt-8">
        <ul className="flex flex-wrap gap-3">
          {[
            { label: 'Edit the homepage', href: '/admin/pages' },
            { label: 'Add a coach', href: '/admin/fleet/new' },
            { label: 'Upload media', href: '/admin/media' },
            { label: 'Edit menus', href: '/admin/menus' },
            { label: 'Theme and fonts', href: '/admin/appearance' },
            { label: 'SEO audit', href: '/admin/seo/audit' },
            { label: 'Redirects', href: '/admin/seo/redirects' },
          ].map((action) => (
            <li key={action.href}>
              <Link href={action.href} className="kc-btn kc-btn-outline !px-4 !py-2.5">
                {action.label}
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
