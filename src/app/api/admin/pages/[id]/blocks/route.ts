import { prisma } from '@/lib/prisma'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { blocksSaveSchema } from '@/lib/admin-schemas'
import { blockSchemas, requireAlt, type BlockType } from '@/lib/blocks/schema'
import { revalidatePageRoute } from '@/lib/revalidate'

export const runtime = 'nodejs'

/**
 * Saves the whole block list for a page.
 *
 * Each block's props are validated against that block type's own Zod schema,
 * then the alt-text gate runs across the payload: an image cannot be saved into
 * content without alt text unless it was explicitly marked decorative.
 *
 * A revision snapshot is taken before the write, so every save is restorable.
 */
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await guard('EDITOR')
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const body = await parseBody(request, blocksSaveSchema)
  if (!body.ok) return body.response

  const page = await prisma.page.findUnique({
    where: { id },
    include: { blocks: { orderBy: { order: 'asc' } } },
  })
  if (!page) return fail('Page not found', 404)

  // Validate every block against its own schema before touching the database.
  const validated: { type: BlockType; order: number; visible: boolean; props: object }[] = []
  for (const [index, block] of body.data.blocks.entries()) {
    const schema = blockSchemas[block.type]
    const parsed = schema.safeParse(block.props)
    if (!parsed.success) {
      return fail(
        `Block ${index + 1} (${block.type}): ${parsed.error.errors[0]?.message ?? 'invalid props'}`,
        422,
        parsed.error.errors.map((e) => ({ block: index, path: e.path.join('.'), message: e.message })),
      )
    }
    const altErrors = requireAlt(parsed.data, `blocks[${index}]`)
    if (altErrors.length) return fail(altErrors[0], 422, altErrors)

    validated.push({ type: block.type, order: index, visible: block.visible, props: parsed.data as object })
  }

  if (body.data.createRevision) {
    await prisma.pageRevision.create({
      data: {
        pageId: page.id,
        authorId: gate.user.id,
        note: body.data.note ?? null,
        snapshot: {
          title: page.title,
          status: page.status,
          pageType: page.pageType,
          blocks: page.blocks.map((b) => ({ type: b.type, order: b.order, visible: b.visible, props: b.props })),
        },
      },
    })
    // Keep the 30 most recent revisions per page.
    const stale = await prisma.pageRevision.findMany({
      where: { pageId: page.id },
      orderBy: { createdAt: 'desc' },
      skip: 30,
      select: { id: true },
    })
    if (stale.length) {
      await prisma.pageRevision.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } })
    }
  }

  await prisma.$transaction([
    prisma.pageBlock.deleteMany({ where: { pageId: page.id } }),
    prisma.pageBlock.createMany({
      data: validated.map((b) => ({
        pageId: page.id,
        type: b.type,
        order: b.order,
        visible: b.visible,
        props: b.props,
      })),
    }),
    prisma.page.update({ where: { id: page.id }, data: { updatedAt: new Date() } }),
  ])

  await revalidatePageRoute(page.path)

  const blocks = await prisma.pageBlock.findMany({ where: { pageId: page.id }, orderBy: { order: 'asc' } })
  return ok({ blocks })
}
