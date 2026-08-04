import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { blockSchemas, isBlockType } from '@/lib/blocks/schema'
import { revalidatePageRoute } from '@/lib/revalidate'

export const runtime = 'nodejs'

const restoreSchema = z.object({ revisionId: z.string().min(1) })

/** Revision history for a page. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await guard('EDITOR')
  if (!gate.ok) return gate.response
  const { id } = await ctx.params

  const revisions = await prisma.pageRevision.findMany({
    where: { pageId: id },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { author: { select: { name: true } } },
  })

  return ok(
    revisions.map((r) => ({
      id: r.id,
      note: r.note,
      author: r.author?.name ?? 'Unknown',
      createdAt: r.createdAt,
      blockCount: Array.isArray((r.snapshot as { blocks?: unknown[] }).blocks)
        ? (r.snapshot as { blocks: unknown[] }).blocks.length
        : 0,
    })),
  )
}

/** Restores a revision. The current state is snapshotted first, so restore is undoable. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await guard('EDITOR')
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const body = await parseBody(request, restoreSchema)
  if (!body.ok) return body.response

  const [page, revision] = await Promise.all([
    prisma.page.findUnique({ where: { id }, include: { blocks: { orderBy: { order: 'asc' } } } }),
    prisma.pageRevision.findUnique({ where: { id: body.data.revisionId } }),
  ])
  if (!page) return fail('Page not found', 404)
  if (!revision || revision.pageId !== page.id) return fail('Revision not found', 404)

  const snapshot = revision.snapshot as {
    title?: string
    pageType?: string
    blocks?: { type: string; order: number; visible: boolean; props: unknown }[]
  }

  const restored = (snapshot.blocks ?? [])
    .filter((b) => isBlockType(b.type))
    .map((b, index) => {
      const type = b.type as keyof typeof blockSchemas
      const parsed = blockSchemas[type].safeParse(b.props)
      return {
        pageId: page.id,
        type: b.type,
        order: index,
        visible: b.visible ?? true,
        props: (parsed.success ? parsed.data : blockSchemas[type].parse({})) as object,
      }
    })

  // Snapshot the pre-restore state so the restore itself can be undone.
  await prisma.pageRevision.create({
    data: {
      pageId: page.id,
      authorId: gate.user.id,
      note: `Auto-snapshot before restoring revision ${revision.id}`,
      snapshot: {
        title: page.title,
        status: page.status,
        pageType: page.pageType,
        blocks: page.blocks.map((b) => ({ type: b.type, order: b.order, visible: b.visible, props: b.props })),
      },
    },
  })

  await prisma.$transaction([
    prisma.pageBlock.deleteMany({ where: { pageId: page.id } }),
    prisma.pageBlock.createMany({ data: restored }),
    prisma.page.update({
      where: { id: page.id },
      data: { title: snapshot.title ?? page.title, pageType: snapshot.pageType ?? page.pageType },
    }),
  ])

  await revalidatePageRoute(page.path)
  return ok({ restored: restored.length })
}
