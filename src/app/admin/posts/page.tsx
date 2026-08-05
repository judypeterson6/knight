import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { isoDate } from '@/lib/utils'
import { AdminPageHeader, EmptyState } from '@/components/admin/ui'
import { PostsTable } from '@/components/admin/posts-table'

export const dynamic = 'force-dynamic'

export default async function PostsList({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const gate = await requireRole('AUTHOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const { q, status } = await searchParams

  const [posts, categories] = await Promise.all([
    prisma.post
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
      .catch(() => []),
    prisma.category.findMany({ orderBy: { order: 'asc' }, select: { id: true, name: true } }).catch(() => []),
  ])

  return (
    <>
      <AdminPageHeader
        title="Posts"
        description="Blog posts use categories only — this site has no tag system by design. Select posts to publish, archive, recategorise or delete them in bulk."
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
        <PostsTable
          posts={posts.map((post) => ({
            id: post.id,
            slug: post.slug,
            title: post.title,
            status: post.status,
            author: post.author?.name ?? '',
            category: post.category?.name ?? '',
            publishedAt: post.publishedAt ? isoDate(post.publishedAt) : null,
          }))}
          categories={categories}
          canDelete={gate.user.role !== 'AUTHOR'}
        />
      )}
    </>
  )
}
