import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { formatDate } from '@/lib/utils'
import { AdminPageHeader, Badge, Cell, DataTable, EmptyState, Row } from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function PostsList({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const gate = await requireRole('AUTHOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const { q, status } = await searchParams

  const posts = await prisma.post
    .findMany({
      where: {
        ...(q ? { OR: [{ title: { contains: q } }, { slug: { contains: q } }] } : {}),
        ...(status && status !== 'ALL'
          ? { status: status as 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED' }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: { author: { select: { name: true } }, category: { select: { name: true } } },
    })
    .catch(() => [])

  return (
    <>
      <AdminPageHeader
        title="Posts"
        description="Blog posts use categories only — this site has no tag system by design."
        actions={
          <Link href="/admin/posts/new" className="kc-btn kc-btn-primary !px-5 !py-2.5">
            New post
          </Link>
        }
      />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-4">
        <div className="min-w-52 flex-1">
          <label htmlFor="q" className="kc-label">
            Search
          </label>
          <input id="q" name="q" defaultValue={q ?? ''} placeholder="Title or slug" className="kc-field" />
        </div>
        <div>
          <label htmlFor="status" className="kc-label">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? 'ALL'} className="kc-field">
            {['ALL', 'DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="kc-btn kc-btn-primary !px-5 !py-3">
          Filter
        </button>
      </form>

      {posts.length === 0 ? (
        <EmptyState
          title="No posts match"
          body="Try a different search, or write a new guide."
          action={
            <Link href="/admin/posts/new" className="kc-btn kc-btn-primary !px-5 !py-2.5">
              New post
            </Link>
          }
        />
      ) : (
        <DataTable head={['Title', 'Category', 'Author', 'Status', 'Published', '']}>
          {posts.map((post) => (
            <Row key={post.id}>
              <Cell>
                <Link href={`/admin/posts/${post.id}`} className="font-bold text-primary hover:underline">
                  {post.title}
                </Link>
                <span className="block font-mono text-[0.7rem] text-subtle">/blog/{post.slug}</span>
              </Cell>
              <Cell className="text-muted">{post.category?.name ?? '—'}</Cell>
              <Cell className="text-muted">{post.author?.name ?? '—'}</Cell>
              <Cell>
                <Badge>{post.status}</Badge>
              </Cell>
              <Cell className="text-muted">{post.publishedAt ? formatDate(post.publishedAt) : '—'}</Cell>
              <Cell>
                <div className="flex gap-3">
                  <Link href={`/admin/posts/${post.id}`} className="font-bold text-primary hover:underline">
                    Edit
                  </Link>
                  <Link href={`/blog/${post.slug}`} className="font-bold text-muted hover:text-primary hover:underline">
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
