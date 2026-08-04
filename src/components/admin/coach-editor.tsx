'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { slugify } from '@/lib/utils'
import { Text } from '@/components/admin/props-inspector'

interface CoachForm {
  name: string
  slug: string
  status: string
  classId: string
  chassis: string
  bunks: number
  slideOuts: string
  rearConfig: string
  amenities: string[]
  description: string
  tagline: string
  dailyPrice: number | null
  currency: string
  available: boolean
  featured: boolean
  displayOrder: number
}

interface GalleryItem {
  mediaId: string
  order: number
  caption: string
  path: string
  filename: string
  alt: string
}

export function CoachEditor({
  coachId,
  initial,
  images: initialImages,
  classes,
  media,
  seo: initialSeo,
}: {
  coachId: string | null
  initial: CoachForm
  images: GalleryItem[]
  classes: { id: string; name: string }[]
  media: { id: string; path: string; alt: string; decorative: boolean; filename: string }[]
  seo: { title: string; description: string; ogImage: string; robots: string }
}) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [images, setImages] = useState(initialImages)
  const [seo, setSeo] = useState(initialSeo)
  const [id, setId] = useState(coachId)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function set<K extends keyof CoachForm>(key: K, value: CoachForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    setBusy(true)
    setMessage('Saving…')

    const payload = {
      ...form,
      classId: form.classId || null,
      tagline: form.tagline || null,
      dailyPrice: form.dailyPrice,
    }

    const res = await fetch(id ? `/api/admin/coaches/${id}` : '/api/admin/coaches', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = (await res.json()) as { ok: boolean; error?: string; data?: { id: string } }

    if (!body.ok) {
      setBusy(false)
      setMessage(body.error ?? 'Save failed.')
      return
    }

    const savedId = id ?? body.data?.id ?? null
    if (savedId) {
      const gallery = await fetch(`/api/admin/coaches/${savedId}/images`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          images: images.map((img, index) => ({ mediaId: img.mediaId, order: index, caption: img.caption || null })),
        }),
      })
      const galleryBody = (await gallery.json()) as { ok: boolean; error?: string }
      if (!galleryBody.ok) {
        setBusy(false)
        setMessage(galleryBody.error ?? 'Coach saved, but the gallery did not.')
        return
      }
    }

    setBusy(false)
    setMessage('Saved.')
    if (!id && savedId) {
      setId(savedId)
      router.replace(`/admin/fleet/${savedId}`)
    }
  }

  async function saveSeo() {
    if (!id) {
      setMessage('Save the coach first, then set its SEO.')
      return
    }
    const res = await fetch('/api/admin/seo', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entityType: 'COACH', entityId: id, ...seo, sitemapExclude: false }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }
    setMessage(body.ok ? 'SEO saved.' : (body.error ?? 'Save failed.'))
  }

  function addImage(mediaId: string) {
    const asset = media.find((m) => m.id === mediaId)
    if (!asset || images.some((i) => i.mediaId === mediaId)) return
    setImages([
      ...images,
      { mediaId, order: images.length, caption: '', path: asset.path, filename: asset.filename, alt: asset.alt },
    ])
  }

  function moveImage(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= images.length) return
    const next = [...images]
    ;[next[index], next[target]] = [next[target], next[index]]
    setImages(next)
  }

  const unlabelled = images.filter((i) => !i.alt.trim())

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <section className="grid gap-4 rounded-card border border-line bg-surface p-6 sm:grid-cols-2">
          <h2 className="sm:col-span-2 text-step-1">Specification</h2>

          <Text
            label="Name"
            value={form.name}
            onChange={(v) => {
              set('name', v)
              if (!id) set('slug', slugify(v))
            }}
          />
          <Text label="Slug" value={form.slug} onChange={(v) => set('slug', slugify(v))} help={`/fleet/${form.slug || '…'}`} />

          <div>
            <label htmlFor="coach-class" className="kc-label">
              Class
            </label>
            <select id="coach-class" value={form.classId} onChange={(e) => set('classId', e.target.value)} className="kc-field">
              <option value="">Unclassified</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="coach-chassis" className="kc-label">
              Chassis
            </label>
            <select id="coach-chassis" value={form.chassis} onChange={(e) => set('chassis', e.target.value)} className="kc-field">
              {['Prevost H3-45', 'Prevost X3-45'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <Text label="Bunks" type="number" value={String(form.bunks)} onChange={(v) => set('bunks', Number(v) || 0)} />

          <div>
            <label htmlFor="coach-slides" className="kc-label">
              Slide-outs
            </label>
            <select id="coach-slides" value={form.slideOuts} onChange={(e) => set('slideOuts', e.target.value)} className="kc-field">
              {['Single Slide', 'Double Slide', 'Triple Slide', 'No Slide'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <Text label="Rear configuration" value={form.rearConfig} onChange={(v) => set('rearConfig', v)} help="Rear Lounge, Master Suite, Star Config, Rear Suite, Sofa Lounge…" />
          <Text label="Tagline" value={form.tagline} onChange={(v) => set('tagline', v)} help="Badge shown on the card, e.g. Most Booked." />

          <div className="sm:col-span-2">
            <label htmlFor="coach-amenities" className="kc-label">
              Amenities (one per line)
            </label>
            <textarea
              id="coach-amenities"
              rows={7}
              value={form.amenities.join('\n')}
              onChange={(e) => set('amenities', e.target.value.split('\n').filter((l) => l.trim()))}
              className="kc-field resize-y"
            />
          </div>

          <div className="sm:col-span-2">
            <Text label="Description" value={form.description} multiline onChange={(v) => set('description', v)} help="Renders as the layout description on the coach page." />
          </div>
        </section>

        <section className="rounded-card border border-line bg-surface p-6">
          <h2 className="text-step-1">Gallery</h2>
          <p className="mt-1.5 text-step--1 text-muted">
            The first image is the card and hero image. Captions render as figcaptions and should state the fact the
            photo shows.
          </p>

          {unlabelled.length ? (
            <p role="alert" className="mt-3 rounded-control border border-danger/40 bg-danger/5 p-3 text-step--1 font-bold text-danger">
              {unlabelled.length} image(s) have no alt text. Add it in the media library — the gallery will not save
              otherwise.
            </p>
          ) : null}

          <ul className="mt-4 space-y-2">
            {images.map((image, index) => (
              <li key={image.mediaId} className="flex items-center gap-3 rounded-control border border-line p-2">
                <Image src={image.path} alt={image.alt || image.filename} width={80} height={56} className="h-14 w-20 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-step--1 font-bold">{image.filename}</p>
                  <input
                    aria-label={`Caption for ${image.filename}`}
                    value={image.caption}
                    placeholder="Caption"
                    onChange={(e) => {
                      const next = [...images]
                      next[index] = { ...image, caption: e.target.value }
                      setImages(next)
                    }}
                    className="mt-1 w-full rounded border border-line px-2 py-1 text-step--1"
                  />
                </div>
                <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0} className="px-1.5 disabled:opacity-30" aria-label="Move up">
                  ↑
                </button>
                <button type="button" onClick={() => moveImage(index, 1)} disabled={index === images.length - 1} className="px-1.5 disabled:opacity-30" aria-label="Move down">
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setImages(images.filter((_, i) => i !== index))}
                  className="px-1.5 text-danger"
                  aria-label={`Remove ${image.filename}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <label htmlFor="add-image" className="kc-label">
              Add an image
            </label>
            <select id="add-image" value="" onChange={(e) => e.target.value && addImage(e.target.value)} className="kc-field">
              <option value="">Choose from the media library…</option>
              {media
                .filter((m) => !images.some((i) => i.mediaId === m.id))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.filename}
                    {m.alt || m.decorative ? '' : ' (no alt text)'}
                  </option>
                ))}
            </select>
          </div>
        </section>
      </div>

      <aside className="space-y-5">
        <section className="space-y-4 rounded-card border border-line bg-surface p-5">
          <h2 className="text-step-0 font-extrabold">Availability and pricing</h2>

          <div>
            <label htmlFor="coach-status" className="kc-label">
              Status
            </label>
            <select id="coach-status" value={form.status} onChange={(e) => set('status', e.target.value)} className="kc-field">
              {['DRAFT', 'PUBLISHED', 'ARCHIVED'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="coach-price" className="kc-label">
              Daily rate (whole {form.currency})
            </label>
            <input
              id="coach-price"
              type="number"
              min={0}
              value={form.dailyPrice ?? ''}
              placeholder="Leave blank for “quoted per tour”"
              onChange={(e) => set('dailyPrice', e.target.value === '' ? null : Number(e.target.value))}
              className="kc-field"
            />
            <p className="mt-1.5 text-step--1 text-subtle">
              Blank is a real state, not a missing value: the card shows &ldquo;quoted per tour&rdquo;, the Product
              schema omits the offer, and the /fleet price filter stays hidden until at least one coach has a rate.
            </p>
          </div>

          <label className="flex items-center gap-3 text-step--1 font-semibold">
            <input type="checkbox" checked={form.available} onChange={(e) => set('available', e.target.checked)} className="h-[18px] w-[18px] accent-[var(--color-primary)]" />
            Available for booking
          </label>
          <label className="flex items-center gap-3 text-step--1 font-semibold">
            <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} className="h-[18px] w-[18px] accent-[var(--color-primary)]" />
            Featured
          </label>

          <Text label="Display order" type="number" value={String(form.displayOrder)} onChange={(v) => set('displayOrder', Number(v) || 0)} />

          <p role="status" aria-live="polite" className={message ? 'text-step--1 text-muted' : 'sr-only'}>
            {message}
          </p>

          <button type="button" onClick={() => void save()} disabled={busy} className="kc-btn kc-btn-primary w-full !py-3">
            {busy ? 'Saving…' : id ? 'Save coach' : 'Create coach'}
          </button>
        </section>

        <section className="space-y-4 rounded-card border border-line bg-surface p-5">
          <h2 className="text-step-0 font-extrabold">SEO</h2>
          <Text label="Meta title" value={seo.title} onChange={(v) => setSeo({ ...seo, title: v })} />
          <Text label="Meta description" value={seo.description} multiline onChange={(v) => setSeo({ ...seo, description: v })} />
          <Text label="OG image path" value={seo.ogImage} onChange={(v) => setSeo({ ...seo, ogImage: v })} />
          <button type="button" onClick={() => void saveSeo()} className="kc-btn kc-btn-outline w-full !py-3">
            Save SEO
          </button>
        </section>
      </aside>
    </div>
  )
}
