'use client'

import { useCallback, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { BlockType } from '@/lib/blocks/schema'
import { PropsInspector, type MediaOption } from '@/components/admin/props-inspector'

export interface BuilderBlock {
  id: string
  type: BlockType
  order: number
  visible: boolean
  props: Record<string, unknown>
}

interface LibraryEntry {
  type: BlockType
  label: string
  description: string
  category: string
  icon: string
  dataDriven: boolean
  defaults: Record<string, unknown>
}

interface Revision {
  id: string
  note: string | null
  author: string
  createdAt: string
}

interface SeoRow {
  title: string | null
  description: string | null
  canonical: string | null
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  robots: string
  sitemapExclude: boolean
}

/**
 * Elementor-style page builder.
 *
 * Left rail: the fixed block library, grouped by category. Centre: the ordered
 * block list with reorder, duplicate, delete and show/hide. Right rail: the
 * selected block's fields plus its spacing, background and alignment tokens.
 *
 * This is a fixed block set, not a free-form canvas — every field maps to a
 * property in that block's Zod schema, so nothing can be saved that the
 * renderer cannot render.
 */
export function BlockBuilder({
  pageId,
  pagePath,
  page,
  initialBlocks,
  library,
  categories,
  media,
  seo,
  revisions,
}: {
  pageId: string
  pagePath: string
  page: { title: string; slug: string; path: string; pageType: string; status: string; customCss: string }
  initialBlocks: BuilderBlock[]
  library: LibraryEntry[]
  categories: string[]
  media: MediaOption[]
  seo: SeoRow | null
  revisions: Revision[]
}) {
  const [blocks, setBlocks] = useState<BuilderBlock[]>(initialBlocks)
  const [selectedId, setSelectedId] = useState<string | null>(initialBlocks[0]?.id ?? null)
  const [tab, setTab] = useState<'blocks' | 'settings' | 'seo' | 'revisions'>('blocks')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId])

  const mutate = useCallback((next: BuilderBlock[]) => {
    setBlocks(next.map((b, i) => ({ ...b, order: i })))
    setDirty(true)
  }, [])

  function addBlock(entry: LibraryEntry) {
    const block: BuilderBlock = {
      id: `new-${entry.type}-${blocks.length}-${blocks.reduce((n, b) => n + b.order, 0)}`,
      type: entry.type,
      order: blocks.length,
      visible: true,
      props: structuredClone(entry.defaults),
    }
    mutate([...blocks, block])
    setSelectedId(block.id)
    setTab('blocks')
    setMessage(`${entry.label} added at the end. Drag it into position.`)
  }

  function move(index: number, target: number) {
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    mutate(next)
  }

  function duplicate(index: number) {
    const source = blocks[index]
    const copy: BuilderBlock = {
      ...source,
      id: `new-${source.type}-copy-${blocks.length}`,
      props: structuredClone(source.props),
    }
    const next = [...blocks]
    next.splice(index + 1, 0, copy)
    mutate(next)
    setSelectedId(copy.id)
  }

  function remove(index: number) {
    const block = blocks[index]
    if (!window.confirm(`Delete the ${block.type} block? This can be restored from revision history.`)) return
    const next = blocks.filter((_, i) => i !== index)
    mutate(next)
    if (selectedId === block.id) setSelectedId(next[0]?.id ?? null)
  }

  function toggleVisible(index: number) {
    const next = [...blocks]
    next[index] = { ...next[index], visible: !next[index].visible }
    mutate(next)
  }

  function updateProps(props: Record<string, unknown>) {
    if (!selected) return
    setBlocks((prev) => prev.map((b) => (b.id === selected.id ? { ...b, props } : b)))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    setMessage('Saving…')

    const res = await fetch(`/api/admin/pages/${pageId}/blocks`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        blocks: blocks.map((b, i) => ({ type: b.type, order: i, visible: b.visible, props: b.props })),
        createRevision: true,
      }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string; data?: { blocks: BuilderBlock[] } }

    setSaving(false)
    if (!body.ok) {
      setMessage(body.error ?? 'Save failed.')
      return
    }
    if (body.data?.blocks) {
      setBlocks(
        body.data.blocks.map((b) => ({ ...b, props: b.props as Record<string, unknown> })),
      )
    }
    setDirty(false)
    setMessage('Saved. The live page has been revalidated.')
  }

  async function restore(revisionId: string) {
    if (!window.confirm('Restore this revision? The current state is snapshotted first, so this is undoable.')) return
    setMessage('Restoring…')
    const res = await fetch(`/api/admin/pages/${pageId}/revisions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revisionId }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }
    setMessage(body.ok ? 'Restored. Reload to see the restored blocks.' : (body.error ?? 'Restore failed.'))
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[16rem_minmax(0,1fr)_22rem]">
      {/* LEFT RAIL — block library */}
      <aside aria-label="Block library" className="rounded-card border border-line bg-surface p-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
        <h2 className="mb-3 text-step-0 font-extrabold">Block library</h2>
        {categories.map((category) => {
          const entries = library.filter((entry) => entry.category === category)
          if (!entries.length) return null
          return (
            <section key={category} className="mb-5">
              <h3 className="mb-2 text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-subtle">{category}</h3>
              <ul className="space-y-1.5">
                {entries.map((entry) => (
                  <li key={entry.type}>
                    <button
                      type="button"
                      onClick={() => addBlock(entry)}
                      title={entry.description}
                      className="w-full rounded-control border border-line px-3 py-2 text-left text-step--1 font-semibold transition hover:border-primary hover:text-primary"
                    >
                      {entry.label}
                      {entry.dataDriven ? (
                        <span className="ml-1.5 text-[0.6rem] font-bold uppercase text-subtle">DB</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </aside>

      {/* CENTRE — block list */}
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-4">
          <nav aria-label="Editor sections" className="flex flex-wrap gap-2">
            {(
              [
                ['blocks', `Blocks (${blocks.length})`],
                ['settings', 'Page settings'],
                ['seo', 'SEO'],
                ['revisions', `Revisions (${revisions.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-current={tab === key ? 'true' : undefined}
                className={cn(
                  'rounded-pill px-3.5 py-2 text-step--1 font-bold',
                  tab === key ? 'bg-primary text-primary-contrast' : 'bg-surface-alt text-muted',
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          <p role="status" aria-live="polite" className={cn('ml-auto text-step--1', message ? 'text-muted' : 'sr-only')}>
            {message}
          </p>

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty}
            className="kc-btn kc-btn-primary !px-5 !py-2.5 !text-step--1 disabled:opacity-50"
          >
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>

        {tab === 'blocks' ? (
          blocks.length === 0 ? (
            <p className="rounded-card border border-dashed border-line bg-surface-alt p-10 text-center text-muted">
              No blocks yet. Add one from the library on the left.
            </p>
          ) : (
            <ol className="space-y-2">
              {blocks.map((block, index) => (
                <li
                  key={block.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null && dragIndex !== index) move(dragIndex, index)
                    setDragIndex(null)
                  }}
                  className={cn(
                    'flex items-center gap-3 rounded-card border bg-surface px-4 py-3 transition',
                    selectedId === block.id ? 'border-primary shadow-card' : 'border-line',
                    !block.visible && 'opacity-60',
                  )}
                >
                  <span aria-hidden className="cursor-grab text-subtle">
                    ⠿
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedId(block.id)}
                    className="flex-1 text-left"
                    aria-pressed={selectedId === block.id}
                  >
                    <span className="block text-step-0 font-extrabold">
                      {index + 1}. {library.find((l) => l.type === block.type)?.label ?? block.type}
                    </span>
                    <span className="block text-step--1 text-muted">
                      {String(block.props.heading || block.props.eyebrow || block.type)}
                      {block.visible ? '' : ' · hidden'}
                    </span>
                  </button>

                  <div className="flex items-center gap-1">
                    <IconButton label={`Move block ${index + 1} up`} disabled={index === 0} onClick={() => move(index, index - 1)}>
                      ↑
                    </IconButton>
                    <IconButton
                      label={`Move block ${index + 1} down`}
                      disabled={index === blocks.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      ↓
                    </IconButton>
                    <IconButton label={`${block.visible ? 'Hide' : 'Show'} block ${index + 1}`} onClick={() => toggleVisible(index)}>
                      {block.visible ? '👁' : '⃠'}
                    </IconButton>
                    <IconButton label={`Duplicate block ${index + 1}`} onClick={() => duplicate(index)}>
                      ⧉
                    </IconButton>
                    <IconButton label={`Delete block ${index + 1}`} onClick={() => remove(index)} danger>
                      ✕
                    </IconButton>
                  </div>
                </li>
              ))}
            </ol>
          )
        ) : null}

        {tab === 'settings' ? <PageSettings pageId={pageId} page={page} onMessage={setMessage} /> : null}
        {tab === 'seo' ? <SeoPanel entityId={pageId} route={pagePath} initial={seo} onMessage={setMessage} /> : null}

        {tab === 'revisions' ? (
          revisions.length === 0 ? (
            <p className="rounded-card border border-dashed border-line bg-surface-alt p-10 text-center text-muted">
              No revisions yet. One is recorded automatically each time you save.
            </p>
          ) : (
            <ul className="space-y-2">
              {revisions.map((revision) => (
                <li key={revision.id} className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3">
                  <div>
                    <p className="text-step-0 font-bold">{new Date(revision.createdAt).toLocaleString()}</p>
                    <p className="text-step--1 text-muted">
                      {revision.author}
                      {revision.note ? ` · ${revision.note}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void restore(revision.id)}
                    className="kc-btn kc-btn-outline !px-4 !py-2 !text-step--1"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>

      {/* RIGHT RAIL — inspector */}
      <aside aria-label="Block settings" className="rounded-card border border-line bg-surface p-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
        {selected ? (
          <PropsInspector
            key={selected.id}
            blockType={selected.type}
            label={library.find((l) => l.type === selected.type)?.label ?? selected.type}
            description={library.find((l) => l.type === selected.type)?.description ?? ''}
            props={selected.props}
            media={media}
            onChange={updateProps}
          />
        ) : (
          <p className="text-step--1 text-muted">Select a block to edit its fields.</p>
        )}
      </aside>
    </div>
  )
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-control border border-line text-step--1 transition disabled:opacity-30',
        danger ? 'hover:border-danger hover:text-danger' : 'hover:border-primary hover:text-primary',
      )}
    >
      <span aria-hidden>{children}</span>
      <span className="sr-only">{label}</span>
    </button>
  )
}

function PageSettings({
  pageId,
  page,
  onMessage,
}: {
  pageId: string
  page: { title: string; slug: string; path: string; pageType: string; status: string; customCss: string }
  onMessage: (message: string) => void
}) {
  const [form, setForm] = useState(page)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const res = await fetch(`/api/admin/pages/${pageId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }
    setBusy(false)
    onMessage(body.ok ? 'Page settings saved.' : (body.error ?? 'Save failed.'))
  }

  return (
    <section className="space-y-4 rounded-card border border-line bg-surface p-6">
      <Field label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
      <Field label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
      <Field label="Path" value={form.path} onChange={(v) => setForm({ ...form, path: v })} help="Leading slash, no trailing slash. Changing this needs a redirect from the old path." />
      <div>
        <label htmlFor="pageType" className="kc-label">
          Page type
        </label>
        <select
          id="pageType"
          value={form.pageType}
          onChange={(e) => setForm({ ...form, pageType: e.target.value })}
          className="kc-field"
        >
          {['home', 'service', 'location', 'fleet-listing', 'about', 'contact', 'legal'].map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="status" className="kc-label">
          Status
        </label>
        <select
          id="status"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          className="kc-field"
        >
          {['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED'].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="customCss" className="kc-label">
          Page-specific CSS
        </label>
        <textarea
          id="customCss"
          rows={6}
          value={form.customCss}
          onChange={(e) => setForm({ ...form, customCss: e.target.value })}
          className="kc-field font-mono text-step--1"
        />
      </div>
      <button type="button" onClick={() => void save()} disabled={busy} className="kc-btn kc-btn-primary !px-5 !py-2.5">
        {busy ? 'Saving…' : 'Save page settings'}
      </button>
    </section>
  )
}

function SeoPanel({
  entityId,
  route,
  initial,
  onMessage,
}: {
  entityId: string
  route: string
  initial: SeoRow | null
  onMessage: (message: string) => void
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    canonical: initial?.canonical ?? '',
    ogTitle: initial?.ogTitle ?? '',
    ogDescription: initial?.ogDescription ?? '',
    ogImage: initial?.ogImage ?? '',
    robots: initial?.robots ?? 'INDEX_FOLLOW',
    sitemapExclude: initial?.sitemapExclude ?? false,
  })
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const res = await fetch('/api/admin/seo', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entityType: 'PAGE', entityId, ...form }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }
    setBusy(false)
    onMessage(body.ok ? 'SEO saved.' : (body.error ?? 'Save failed.'))
  }

  async function submitUrl() {
    onMessage('Submitting…')
    const res = await fetch('/api/admin/indexing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ urls: [route], providers: ['INDEXNOW', 'SITEMAP_PING'], action: 'URL_UPDATED' }),
    })
    const body = (await res.json()) as { ok: boolean; data?: { results: { provider: string; message: string }[] } }
    onMessage(body.data?.results.map((r) => `${r.provider}: ${r.message}`).join(' · ') ?? 'Submission failed.')
  }

  return (
    <section className="space-y-4 rounded-card border border-line bg-surface p-6">
      <Field label="Meta title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} help={`${form.title.length} characters. Aim for under 60.`} />
      <Field label="Meta description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} multiline help={`${form.description.length} characters. Aim for 120–160.`} />
      <Field label="Canonical" value={form.canonical} onChange={(v) => setForm({ ...form, canonical: v })} help={`Defaults to ${route}.`} />
      <Field label="OG title" value={form.ogTitle} onChange={(v) => setForm({ ...form, ogTitle: v })} />
      <Field label="OG description" value={form.ogDescription} onChange={(v) => setForm({ ...form, ogDescription: v })} multiline />
      <Field label="OG image path" value={form.ogImage} onChange={(v) => setForm({ ...form, ogImage: v })} />

      <div>
        <label htmlFor="robots" className="kc-label">
          Robots
        </label>
        <select id="robots" value={form.robots} onChange={(e) => setForm({ ...form, robots: e.target.value })} className="kc-field">
          {['INDEX_FOLLOW', 'NOINDEX_FOLLOW', 'INDEX_NOFOLLOW', 'NOINDEX_NOFOLLOW'].map((value) => (
            <option key={value} value={value}>
              {value.toLowerCase().replace('_', ', ')}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-3 text-step--1 font-semibold">
        <input
          type="checkbox"
          checked={form.sitemapExclude}
          onChange={(e) => setForm({ ...form, sitemapExclude: e.target.checked })}
          className="h-[18px] w-[18px] accent-[var(--color-primary)]"
        />
        Exclude this URL from the XML sitemap
      </label>

      <p className="text-step--1 text-subtle">
        There is no keywords field. Meta keywords is a deprecated signal and is not emitted anywhere on this site.
      </p>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void save()} disabled={busy} className="kc-btn kc-btn-primary !px-5 !py-2.5">
          {busy ? 'Saving…' : 'Save SEO'}
        </button>
        <button type="button" onClick={() => void submitUrl()} className="kc-btn kc-btn-outline !px-5 !py-2.5">
          Submit URL to search engines
        </button>
      </div>
    </section>
  )
}

export function Field({
  label,
  value,
  onChange,
  help,
  multiline,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  help?: string
  multiline?: boolean
  type?: string
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div>
      <label htmlFor={id} className="kc-label">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} className="kc-field resize-y" />
      ) : (
        <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="kc-field" />
      )}
      {help ? <p className="mt-1.5 text-step--1 text-subtle">{help}</p> : null}
    </div>
  )
}
