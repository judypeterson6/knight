import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { fail, guard, ok } from '@/lib/api'
import { slugify } from '@/lib/utils'

export const runtime = 'nodejs'

const MAX_IMAGE_BYTES = 15 * 1024 * 1024
// Video gets more room because a usable hero loop does not fit in 15 MB, but
// the ceiling is deliberate: anything past this belongs on a video host, not
// in the site's own uploads directory.
const MAX_VIDEO_BYTES = 64 * 1024 * 1024

const ALLOWED_IMAGES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'])
// MP4 plays everywhere; WebM is smaller where the browser takes it.
const ALLOWED_VIDEO = new Set(['video/mp4', 'video/webm'])

const isVideo = (type: string) => ALLOWED_VIDEO.has(type)

/** Media library listing, with a search filter. */
export async function GET(request: Request): Promise<Response> {
  const gate = await guard('AUTHOR')
  if (!gate.ok) return gate.response

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  const media = await prisma.media.findMany({
    where: q
      ? {
          OR: [
            { filename: { contains: q } },
            { alt: { contains: q } },
            { title: { contains: q } },
            { caption: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return ok(media)
}

/**
 * Upload. Multipart, one or more files.
 *
 * Alt text is required at upload time — it is a form field, not an afterthought.
 * The only way to store an empty alt is to tick "decorative" explicitly.
 */
export async function POST(request: Request): Promise<Response> {
  const gate = await guard('AUTHOR')
  if (!gate.ok) return gate.response

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return fail('Expected a multipart upload')
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File)
  if (!files.length) return fail('No files supplied')

  const alt = String(form.get('alt') ?? '').trim()
  const decorative = form.get('decorative') === 'true'

  // Alt text describes an image. A background video carries no information a
  // screen reader can use and is rendered aria-hidden, so it is stored as
  // decorative rather than being blocked on a field that does not apply.
  const videoOnly = files.every((f) => isVideo(f.type))
  if (!videoOnly && !alt && !decorative) {
    return fail('Alt text is required. Tick "decorative" only if the image carries no information.', 422)
  }

  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const dir = path.join(process.cwd(), 'public', 'uploads', year, month)
  await mkdir(dir, { recursive: true })

  const created = []
  for (const file of files) {
    const video = isVideo(file.type)
    const limit = video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    if (file.size > limit) {
      return fail(`${file.name} is larger than ${Math.round(limit / 1024 / 1024)} MB`, 413)
    }
    if (!ALLOWED_IMAGES.has(file.type) && !video) {
      return fail(`${file.name} is not an accepted image or video type`, 415)
    }

    const ext = path.extname(file.name) || '.png'
    const stem = slugify(path.basename(file.name, ext)) || 'upload'
    let filename = `${stem}${ext}`
    let publicPath = `/uploads/${year}/${month}/${filename}`

    // Never overwrite an existing asset.
    let suffix = 1
    while (await prisma.media.findUnique({ where: { path: publicPath }, select: { id: true } })) {
      filename = `${stem}-${suffix}${ext}`
      publicPath = `/uploads/${year}/${month}/${filename}`
      suffix += 1
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(dir, filename), buffer)

    let width: number | null = null
    let height: number | null = null
    // sharp reads images. Probing a video would need ffmpeg, and the hero uses
    // object-cover so intrinsic dimensions are not needed to render it.
    if (!video && file.type !== 'image/svg+xml') {
      try {
        const meta = await sharp(buffer).metadata()
        width = meta.width ?? null
        height = meta.height ?? null
      } catch {
        // Dimensions stay null; the UI then asks for them explicitly.
      }
    }

    const record = await prisma.media.create({
      data: {
        path: publicPath,
        filename,
        mimeType: file.type,
        width,
        height,
        bytes: buffer.byteLength,
        alt: video ? '' : decorative ? '' : alt,
        decorative: video ? true : decorative,
        title: String(form.get('title') ?? '') || null,
        caption: String(form.get('caption') ?? '') || null,
      },
    })
    created.push(record)
  }

  return ok(created, 201)
}
