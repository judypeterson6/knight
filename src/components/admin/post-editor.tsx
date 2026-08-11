'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { slugify } from '@/lib/utils'
import { RichTextEditor } from '@/components/admin/rich-text-editor'
import { Text } from '@/components/admin/props-inspector'
import { PostRevisions } from '@/components/admin/post-revisions'
import { SchemaOverrideEditor } from '@/components/admin/schema-override-editor'

interface PostForm {
  title: string
  slug: string
  excerpt: string
  body: string
  status: string
  categoryId: string
  featuredImageId: string
  authorId: string
  publishedAt: string
}

interface SeoForm {
  title: string
  description: string
  canonical: string
  ogImage: string
  robots: string
  schemaType: string
}

/**
 * Post editor. Autosaves an existing post 3 seconds after typing stops; a new
 * post is created explicitly so an abandoned draft never appears in the list.
 */
export function PostEditor({
  postId,
  initial,
  seo: initialSeo,
  categories,
  media,
  users,
  canChooseAuthor,
}: {
  postId: string | null
  initial: PostForm
  seo: SeoForm
  categories: { id: string; name: string }[]
  media: { id: string; path: string; alt: string; filename: string }[]
  users: { id: string; name: string }[]
  canChooseAuthor: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState<PostForm>(initial)
  const [seo, setSeo] = useState<SeoForm>(initialSeo)
  const [id, setId] = useState(postId)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const autosave = useRef<ReturnType<typeof setTimeout> | null>(null)

  function update(patch: Partial<PostForm>) {
    setForm((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  // Autosave existing posts only.
  useEffect(() => {
    if (!id || !dirty) return
    if (autosave.current) clearTimeout(autosave.current)
    autosave.current = setTimeout(() => void save(true), 3000)
    return () => {
      if (autosave.current) clearTimeout(autosave.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, dirty, id])

  async function save(silent = false) {
    setBusy(true)
    if (!silent) setMessage('Saving…')

    const payload = {
      ...form,
      categoryId: form.categoryId || null,
      featuredImageId: form.featuredImageId || null,
      authorId: form.authorId || null,
      excerpt: form.excerpt || null,
      publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
    }

    const res = await fetch(id ? `/api/admin/posts/${id}` : '/api/admin/posts', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = (await res.json()) as { ok: boolean; error?: string; data?: { id: string } }

    setBusy(false)
    if (!body.ok) {
      setMessage(body.error ?? 'Save failed.')
      return
    }

    setDirty(false)
    setMessage(silent ? `Autosaved at ${new Date().toLocaleTimeString()}` : 'Saved.')

    if (!id && body.data?.id) {
      setId(body.data.id)
      router.replace(`/admin/posts/${body.data.id}`)
    }
  }

  async function saveSeo() {
    if (!id) {
      setMessage('Save the post first, then set its SEO.')
      return
    }
    const res = await fetch('/api/admin/seo', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entityType: 'POST', entityId: id, ...seo, sitemapExclude: false }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }
    setMessage(body.ok ? 'SEO saved.' : (body.error ?? 'Save failed.'))
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-5">
        <div>
          <label htmlFor="post-title" className="kc-label">
            Title
          </label>
          <input
            id="post-title"
            value={form.title}
            onChange={(e) => {
              const title = e.target.value
              update({ title, ...(id ? {} : { slug: slugify(title) }) })
            }}
            className="kc-field !text-step-2 !font-bold"
          />
        </div>

        <div>
          <label htmlFor="post-body" className="kc-label">
            Body
          </label>
          <div id="post-body">
            <RichTextEditor value={form.body} onChange={(html) => update({ body: html })} media={media} />
          </div>
        </div>

        <Text
          label="Excerpt"
          value={form.excerpt}
          multiline
          onChange={(v) => update({ excerpt: v })}
          help="Renders as the opening answer under the H1, and as the meta description fallback."
        />
      </div>

      <aside className="space-y-5">
        <section className="space-y-4 rounded-card border border-line bg-surface p-5">
          <h2 className="text-step-0 font-extrabold">Publish</h2>

          <div>
            <label htmlFor="post-status" className="kc-label">
              Status
            </label>
            <select id="post-status" value={form.status} onChange={(e) => update({ status: e.target.value })} className="kc-field">
              {['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="post-published" className="kc-label">
              Publish date
            </label>
            <input
              id="post-published"
              type="datetime-local"
              value={form.publishedAt}
              onChange={(e) => update({ publishedAt: e.target.value })}
              className="kc-field"
            />
          </div>

          <Text label="Slug" value={form.slug} onChange={(v) => update({ slug: slugify(v) })} help={`/guides/${form.slug || '…'}`} />

          <div>
            <label htmlFor="post-category" className="kc-label">
              Category
            </label>
            <select id="post-category" value={form.categoryId} onChange={(e) => update({ categoryId: e.target.value })} className="kc-field">
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-step--1 text-subtle">Categories only. This site has no tag system.</p>
          </div>

          {canChooseAuthor ? (
            <div>
              <label htmlFor="post-author" className="kc-label">
                Author
              </label>
              <select id="post-author" value={form.authorId} onChange={(e) => update({ authorId: e.target.value })} className="kc-field">
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label htmlFor="post-image" className="kc-label">
              Featured image
            </label>
            <select
              id="post-image"
              value={form.featuredImageId}
              onChange={(e) => update({ featuredImageId: e.target.value })}
              className="kc-field"
            >
              <option value="">None</option>
              {media.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.filename}
                  {item.alt ? '' : ' (no alt text)'}
                </option>
              ))}
            </select>
          </div>

          <p role="status" aria-live="polite" className={message ? 'text-step--1 text-muted' : 'sr-only'}>
            {message}
          </p>

          <button type="button" onClick={() => void save()} disabled={busy} className="kc-btn kc-btn-primary w-full !py-3">
            {busy ? 'Saving…' : id ? 'Save post' : 'Create post'}
          </button>
        </section>

        <section className="space-y-4 rounded-card border border-line bg-surface p-5">
          <h2 className="text-step-0 font-extrabold">SEO</h2>
          <Text label="Meta title" value={seo.title} onChange={(v) => setSeo({ ...seo, title: v })} help={`${seo.title.length} characters`} />
          <Text label="Meta description" value={seo.description} multiline onChange={(v) => setSeo({ ...seo, description: v })} help={`${seo.description.length} characters`} />
          <Text label="Canonical" value={seo.canonical} onChange={(v) => setSeo({ ...seo, canonical: v })} />
          <Text label="OG image path" value={seo.ogImage} onChange={(v) => setSeo({ ...seo, ogImage: v })} />
          <div>
            <label htmlFor="post-robots" className="kc-label">
              Robots
            </label>
            <select id="post-robots" value={seo.robots} onChange={(e) => setSeo({ ...seo, robots: e.target.value })} className="kc-field">
              {['INDEX_FOLLOW', 'NOINDEX_FOLLOW', 'INDEX_NOFOLLOW', 'NOINDEX_NOFOLLOW'].map((value) => (
                <option key={value} value={value}>
                  {value.toLowerCase().replace('_', ', ')}
                </option>
              ))}
            </select>
          </div>
          <Text label="Schema type" value={seo.schemaType} onChange={(v) => setSeo({ ...seo, schemaType: v })} />
          <button type="button" onClick={() => void saveSeo()} className="kc-btn kc-btn-outline w-full !py-3">
            Save SEO
          </button>
        </section>

        {/* Both need a saved post to attach to. */}
        {id ? (
          <>
            <SchemaOverrideEditor entityType="POST" entityId={id} onMessage={setMessage} />
            <PostRevisions postId={id} onMessage={setMessage} />
          </>
        ) : null}
      </aside>
    </div>
  )
}
