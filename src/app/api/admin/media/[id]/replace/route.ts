import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { fail, guard, ok } from '@/lib/api'
import { revalidateStructuredContent } from '@/lib/revalidate'

export const runtime = 'nodejs'

const MAX_BYTES = 15 * 1024 * 1024
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'])

/**
 * Replaces the file behind an existing Media row.
 *
 * The row id and the public path are deliberately kept, so every page, block,
 * coach gallery and post that already references this asset keeps working — that
 * is the entire point of "replace" rather than "delete and re-upload". Only the
 * bytes, dimensions and mime type change.
 *
 * The file extension must match the original, because the stored path carries it
 * and changing it would break the URL this replace exists to preserve.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await guard('EDITOR')
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const media = await prisma.media.findUnique({ where: { id } })
  if (!media) return fail('Not found', 404)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return fail('Expected a multipart upload')
  }

  const file = form.get('file')
  if (!(file instanceof File)) return fail('No file supplied')
  if (file.size > MAX_BYTES) return fail(`${file.name} is larger than 15 MB`, 413)
  if (!ALLOWED.has(file.type)) return fail(`${file.name} is not an accepted image type`, 415)

  const currentExt = path.extname(media.path).toLowerCase()
  const incomingExt = path.extname(file.name).toLowerCase()
  if (currentExt && incomingExt && currentExt !== incomingExt) {
    return fail(
      `The replacement must be a ${currentExt} file — the existing URL ends in ${currentExt} and is already referenced across the site.`,
      422,
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const dest = path.join(process.cwd(), 'public', media.path.replace(/^\//, ''))
  await writeFile(dest, buffer)

  let width = media.width
  let height = media.height
  if (file.type !== 'image/svg+xml') {
    try {
      const meta = await sharp(buffer).metadata()
      width = meta.width ?? width
      height = meta.height ?? height
    } catch {
      // Keep the previous dimensions rather than lose them.
    }
  }

  const updated = await prisma.media.update({
    where: { id },
    data: { bytes: buffer.byteLength, width, height, mimeType: file.type },
  })

  revalidateStructuredContent()
  return ok(updated)
}
