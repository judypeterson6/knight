import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader } from '@/components/admin/ui'
import { PostEditor } from '@/components/admin/post-editor'

export const dynamic = 'force-dynamic'

/** `/admin/posts/new` and `/admin/posts/<id>` share one editor. */
export default async function PostEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole('AUTHOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const { id } = await params
  const isNew = id === 'new'

  const [post, categories, media, users] = await Promise.all([
    isNew
      ? Promise.resolve(null)
      : prisma.post.findUnique({ where: { id }, include: { featuredImage: true } }).catch(() => null),
    prisma.category.findMany({ orderBy: { order: 'asc' }, select: { id: true, name: true } }).catch(() => []),
    prisma.media
      .findMany({ orderBy: { createdAt: 'desc' }, take: 300, select: { id: true, path: true, alt: true, filename: true } })
      .catch(() => []),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true } }).catch(() => []),
  ])

  if (!isNew && !post) notFound()

  const seo = post
    ? await prisma.seoMeta
        .findUnique({ where: { entityType_entityId: { entityType: 'POST', entityId: post.id } } })
        .catch(() => null)
    : null

  return (
    <>
      <AdminPageHeader
        title={isNew ? 'New post' : post!.title}
        description={isNew ? 'Write a guide. Categories only — there is no tag system.' : `/blog/${post!.slug}`}
      />
      <PostEditor
        postId={isNew ? null : post!.id}
        initial={{
          title: post?.title ?? '',
          slug: post?.slug ?? '',
          excerpt: post?.excerpt ?? '',
          body: post?.body ?? '',
          status: post?.status ?? 'DRAFT',
          categoryId: post?.categoryId ?? '',
          featuredImageId: post?.featuredImageId ?? '',
          authorId: post?.authorId ?? gate.user.id,
          publishedAt: post?.publishedAt ? post.publishedAt.toISOString().slice(0, 16) : '',
        }}
        seo={{
          title: seo?.title ?? '',
          description: seo?.description ?? '',
          canonical: seo?.canonical ?? '',
          ogImage: seo?.ogImage ?? '',
          robots: seo?.robots ?? 'INDEX_FOLLOW',
          schemaType: seo?.schemaType ?? 'BlogPosting',
        }}
        categories={categories}
        media={media}
        users={users}
        canChooseAuthor={gate.user.role !== 'AUTHOR'}
      />
    </>
  )
}
