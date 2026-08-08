'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BLOCK_LIBRARY, defaultPropsFor } from '@/lib/blocks/registry'
import type { BlockType } from '@/lib/blocks/schema'

interface PageContext {
  id: string
  title: string
  path: string
  status: string
}

interface ApiBlock {
  id: string
  type: string
  order: number
  visible: boolean
  props: Record<string, unknown>
}

/**
 * A block as held while editing.
 *
 * `key` is the database id for blocks that already exist and a synthetic
 * `new-n` for ones added in this session. The save endpoint replaces the whole
 * list, so ids are never sent — the key only ties a draft entry to the element
 * on the page it was rendered from.
 */
interface DraftBlock {
  key: string
  type: BlockType
  visible: boolean
  props: Record<string, unknown>
  /** Set on blocks added in this session, which have nothing on the page yet. */
  isNew?: boolean
}

/**
 * Front-end editing toolbar.
 *
 * Edit mode does two things at once. Text inside each rendered block becomes
 * editable in place, and every block gains a control strip for moving,
 * duplicating, hiding, deleting and inserting a section after it — so the page
 * can be restructured where it is seen rather than only in /admin.
 *
 * Everything is staged locally and written through the same PageBlock endpoint
 * the admin block builder uses, so schema validation, the alt-text gate,
 * revision snapshots and revalidation are identical on both routes.
 *
 * Only ever rendered for a signed-in admin or editor — see EditToolbarGate.
 */
export function EditToolbar({ userName }: { userName: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [page, setPage] = useState<PageContext | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<DraftBlock[]>([])
  const [dragKey, setDragKey] = useState<string | null>(null)
  /** Which block the picker will insert after; null appends. Kept separate from
      `pickerOpen` so a page with no blocks yet can still add its first one. */
  const [insertAfter, setInsertAfter] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  /** Rendered block elements, so controls can be portalled onto each one. */
  const [anchors, setAnchors] = useState<{ key: string; el: HTMLElement }[]>([])
  const originals = useRef<Map<HTMLElement, string>>(new Map())
  const nextId = useRef(0)

  // Resolve which page we are on after mount, so the site layout itself does no
  // database work for editors browsing the public site.
  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    setEditing(false)
    setDirty(false)

    fetch(`/api/admin/page-context?path=${encodeURIComponent(pathname)}`)
      .then((r) => r.json() as Promise<{ ok: boolean; data: PageContext | null }>)
      .then((body) => {
        if (cancelled) return
        setPage(body.ok ? body.data : null)
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [pathname])

  /** Text nodes that are safe to edit in place — headings and paragraphs only. */
  const editableSelector = 'h1, h2, h3, h4, p, li, figcaption, dd, dt, blockquote'

  /** Loads the real props so blocks can be duplicated and reordered locally. */
  async function startEditing() {
    if (!page) return
    setMessage('Loading blocks…')
    const body = await fetch(`/api/admin/pages/${page.id}`)
      .then((r) => r.json() as Promise<{ ok: boolean; data?: { blocks: ApiBlock[] } }>)
      .catch(() => null)

    if (!body?.ok || !body.data) {
      setMessage('Could not load this page’s blocks.')
      return
    }

    setDraft(
      body.data.blocks.map((b) => ({
        key: b.id,
        type: b.type as BlockType,
        visible: b.visible,
        props: b.props,
      })),
    )
    setEditing(true)
    setMessage('Edit mode on. Click any text to change it, or use the controls on each section.')
  }

  useEffect(() => {
    const root = document.getElementById('main')
    if (!root) return

    const elements = Array.from(root.querySelectorAll<HTMLElement>(editableSelector)).filter(
      (el) => el.closest('[data-block-id]') && !el.querySelector('input, select, textarea, button'),
    )

    function markDirty() {
      setDirty(true)
    }

    if (editing) {
      for (const el of elements) {
        originals.current.set(el, el.innerHTML)
        el.setAttribute('contenteditable', 'plaintext-only')
        el.dataset.kcEditable = 'true'
        el.addEventListener('input', markDirty)
      }
      document.documentElement.classList.add('kc-editing')

      const wrappers = Array.from(root.querySelectorAll<HTMLElement>('[data-block-id]'))
      setAnchors(wrappers.map((el) => ({ key: el.dataset.blockId ?? '', el })).filter((a) => a.key))
    } else {
      for (const el of elements) {
        el.removeAttribute('contenteditable')
        delete el.dataset.kcEditable
        el.removeEventListener('input', markDirty)
      }
      document.documentElement.classList.remove('kc-editing')
      setAnchors([])
    }

    return () => {
      for (const el of elements) el.removeEventListener('input', markDirty)
    }
  }, [editing])

  function discard() {
    for (const [el, html] of originals.current) el.innerHTML = html
    originals.current.clear()
    setDirty(false)
    setEditing(false)
    setDraft([])
    setMessage('Changes discarded.')
  }

  const indexOf = useCallback((key: string) => draft.findIndex((b) => b.key === key), [draft])

  function move(key: string, direction: -1 | 1) {
    setDraft((prev) => {
      const from = prev.findIndex((b) => b.key === key)
      const to = from + direction
      if (from < 0 || to < 0 || to >= prev.length) return prev
      const next = [...prev]
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })
    setDirty(true)
  }

  /** Drag reorder: drop `dragKey` onto the position of `key`. */
  function dropOn(key: string) {
    if (!dragKey || dragKey === key) return
    setDraft((prev) => {
      const from = prev.findIndex((b) => b.key === dragKey)
      const to = prev.findIndex((b) => b.key === key)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setDragKey(null)
    setDirty(true)
  }

  function toggleVisible(key: string) {
    setDraft((prev) => prev.map((b) => (b.key === key ? { ...b, visible: !b.visible } : b)))
    setDirty(true)
  }

  function duplicate(key: string) {
    setDraft((prev) => {
      const at = prev.findIndex((b) => b.key === key)
      if (at < 0) return prev
      nextId.current += 1
      const copy: DraftBlock = {
        key: `new-${nextId.current}`,
        type: prev[at].type,
        visible: prev[at].visible,
        // Structured clone keeps the copy from sharing nested arrays with the
        // original, which would make editing one change both.
        props: JSON.parse(JSON.stringify(prev[at].props)) as Record<string, unknown>,
        isNew: true,
      }
      const next = [...prev]
      next.splice(at + 1, 0, copy)
      return next
    })
    setDirty(true)
    setMessage('Section duplicated. It appears on the page after you save.')
  }

  function remove(key: string) {
    const block = draft.find((b) => b.key === key)
    if (!block) return
    if (!window.confirm(`Delete the ${block.type} section? This applies when you save.`)) return
    setDraft((prev) => prev.filter((b) => b.key !== key))
    setDirty(true)
    setMessage('Section removed. Save to apply.')
  }

  function openPicker(afterKey: string | null) {
    setInsertAfter(afterKey)
    setPickerOpen(true)
  }

  function addSection(type: BlockType, afterKey: string | null) {
    nextId.current += 1
    const created: DraftBlock = {
      key: `new-${nextId.current}`,
      type,
      visible: true,
      props: defaultPropsFor(type),
      isNew: true,
    }
    setDraft((prev) => {
      const at = afterKey ? prev.findIndex((b) => b.key === afterKey) : -1
      const next = [...prev]
      if (at < 0) next.push(created)
      else next.splice(at + 1, 0, created)
      return next
    })
    setInsertAfter(null)
    setPickerOpen(false)
    setDirty(true)
    setDrawerOpen(true)
    setMessage(`${type} added. Fill it in from the block builder, then save.`)
  }

  /**
   * Collects the edited text back into block props and writes the whole list.
   *
   * Each edited element is matched to its block by the `data-block-id` wrapper
   * the renderer emits. Text is matched by its original value rather than by
   * position, so an edit never lands in the wrong property.
   */
  async function save() {
    if (!page) return
    setSaving(true)
    setMessage('Saving…')

    const byKey = new Map(draft.map((b) => [b.key, b]))

    for (const [el, originalHtml] of originals.current) {
      const wrapper = el.closest('[data-block-id]') as HTMLElement | null
      if (!wrapper) continue
      const block = byKey.get(wrapper.dataset.blockId ?? '')
      if (!block) continue

      const before = stripHtml(originalHtml)
      const after = stripHtml(el.innerHTML)
      if (before === after) continue

      replaceStringDeep(block.props, before, after)
    }

    const payload = draft.map((block, index) => ({
      type: block.type,
      order: index,
      visible: block.visible,
      props: block.props,
    }))

    const res = await fetch(`/api/admin/pages/${page.id}/blocks`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ blocks: payload, createRevision: true, note: `Inline edit by ${userName}` }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }

    setSaving(false)
    if (!body.ok) {
      setMessage(body.error ?? 'Save failed.')
      return
    }

    originals.current.clear()
    setDirty(false)
    setEditing(false)
    setMessage('Saved and published.')
    router.refresh()
  }

  const newCount = draft.filter((b) => b.isNew).length

  return (
    <>
      <style>{`
        html.kc-editing [data-kc-editable="true"] { outline: 1px dashed var(--color-primary); outline-offset: 3px; border-radius: 3px; }
        html.kc-editing [data-kc-editable="true"]:focus { outline: 2px solid var(--color-primary); background: var(--color-primary-soft); }
        html.kc-editing [data-block-id] { position: relative; }
        html.kc-editing [data-block-id]:hover { outline: 2px solid var(--color-primary); outline-offset: -2px; }
        html.kc-editing [data-block-id] .kc-block-controls { opacity: 0; transition: opacity .12s; }
        html.kc-editing [data-block-id]:hover .kc-block-controls,
        html.kc-editing [data-block-id] .kc-block-controls:focus-within { opacity: 1; }
        body { padding-bottom: 4.5rem; }
      `}</style>

      {/* Per-section controls, portalled onto the rendered blocks themselves. */}
      {editing
        ? anchors.map(({ key, el }) => {
            const at = indexOf(key)
            if (at < 0) return null
            return createPortal(
              <div
                className="kc-block-controls absolute right-3 top-3 z-[150] flex items-center gap-1 rounded-control border border-line bg-surface p-1 shadow-card"
                role="group"
                aria-label={`${draft[at].type} section controls`}
              >
                <span className="px-2 text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-subtle">
                  {draft[at].type}
                </span>
                <ControlButton label="Move section up" disabled={at === 0} onClick={() => move(key, -1)}>
                  ↑
                </ControlButton>
                <ControlButton
                  label="Move section down"
                  disabled={at === draft.length - 1}
                  onClick={() => move(key, 1)}
                >
                  ↓
                </ControlButton>
                <ControlButton label="Duplicate section" onClick={() => duplicate(key)}>
                  ⧉
                </ControlButton>
                <ControlButton label={draft[at].visible ? 'Hide section' : 'Show section'} onClick={() => toggleVisible(key)}>
                  {draft[at].visible ? '👁' : '🚫'}
                </ControlButton>
                <ControlButton label="Add a section below this one" onClick={() => openPicker(key)}>
                  ＋
                </ControlButton>
                <ControlButton label="Delete section" onClick={() => remove(key)} danger>
                  ✕
                </ControlButton>
              </div>,
              el,
              `controls-${key}`,
            )
          })
        : null}

      <div
        role="region"
        aria-label="Page editing toolbar"
        className="fixed inset-x-0 bottom-0 z-[200] flex flex-wrap items-center gap-3 border-t border-line bg-surface px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
      >
        <p className="mr-auto text-step--1">
          {page ? (
            <>
              <span className="font-extrabold">{page.title}</span>{' '}
              <span className="text-muted">
                · {page.path} · {page.status}
                {editing ? ` · ${draft.length} sections` : ''}
                {newCount ? ` · ${newCount} unsaved` : ''}
              </span>
            </>
          ) : (
            <span className="text-muted">
              {loaded
                ? 'This URL is not a block-built page — edit it from its own admin screen.'
                : 'Loading page…'}
            </span>
          )}
        </p>

        <p role="status" aria-live="polite" className={cn('text-step--1', message ? 'text-muted' : 'sr-only')}>
          {message}
        </p>

        {editing ? (
          <>
            <button
              type="button"
              onClick={() => openPicker(draft.length ? draft[draft.length - 1].key : null)}
              className="rounded-control border border-line px-3.5 py-2 text-step--1 font-bold text-primary"
            >
              Add section
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-expanded={drawerOpen}
              className="rounded-control border border-line px-3.5 py-2 text-step--1 font-bold"
            >
              Sections ({draft.length})
            </button>
            <button
              type="button"
              onClick={discard}
              className="rounded-control border border-line px-3.5 py-2 text-step--1 font-bold"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !dirty}
              className="kc-btn kc-btn-primary !px-5 !py-2 !text-step--1 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (dirty && !window.confirm('You have unsaved changes. Exit edit mode anyway?')) return
                discard()
              }}
              className="rounded-control border border-line px-3.5 py-2 text-step--1 font-bold"
            >
              Exit
            </button>
          </>
        ) : (
          <>
            <Link href="/admin" className="rounded-control border border-line px-3.5 py-2 text-step--1 font-bold">
              Admin
            </Link>
            {page ? (
              <>
                <Link
                  href={`/admin/pages/${page.id}/edit`}
                  className="rounded-control border border-line px-3.5 py-2 text-step--1 font-bold"
                >
                  Open block builder
                </Link>
                <button
                  type="button"
                  onClick={() => void startEditing()}
                  className="kc-btn kc-btn-primary !px-5 !py-2 !text-step--1"
                >
                  Edit this page
                </button>
              </>
            ) : null}
          </>
        )}
      </div>

      {pickerOpen ? (
        <SectionPicker onPick={(type) => addSection(type, insertAfter)} onClose={() => setPickerOpen(false)} />
      ) : null}

      {editing && drawerOpen ? (
        <aside
          aria-label="Sections on this page"
          className="fixed bottom-[4.5rem] right-4 z-[200] max-h-[60vh] w-80 overflow-y-auto rounded-card border border-line bg-surface p-4 shadow-card"
        >
          <h2 className="mb-1 text-step-0 font-extrabold">Sections on this page</h2>
          <p className="mb-3 text-step--1 text-subtle">Drag to reorder. Everything applies when you press Save.</p>
          <ol className="space-y-2">
            {draft.map((block, index) => (
              <li
                key={block.key}
                draggable
                onDragStart={() => setDragKey(block.key)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropOn(block.key)}
                className={cn(
                  'flex items-center gap-2 rounded-control border border-line px-3 py-2',
                  dragKey === block.key && 'opacity-50',
                  block.isNew && 'border-primary bg-primary-soft',
                )}
              >
                <span aria-hidden className="cursor-grab text-subtle">
                  ⠿
                </span>
                <span className={cn('flex-1 text-step--1 font-semibold', !block.visible && 'text-subtle line-through')}>
                  {index + 1}. {block.type}
                  {block.isNew ? ' (new)' : ''}
                </span>
                <ControlButton label={`Move ${block.type} up`} disabled={index === 0} onClick={() => move(block.key, -1)}>
                  ↑
                </ControlButton>
                <ControlButton
                  label={`Move ${block.type} down`}
                  disabled={index === draft.length - 1}
                  onClick={() => move(block.key, 1)}
                >
                  ↓
                </ControlButton>
                <ControlButton label={`Duplicate ${block.type}`} onClick={() => duplicate(block.key)}>
                  ⧉
                </ControlButton>
                <ControlButton label={`Delete ${block.type}`} onClick={() => remove(block.key)} danger>
                  ✕
                </ControlButton>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => openPicker(draft.length ? draft[draft.length - 1].key : null)}
            className="mt-3 w-full rounded-control border border-dashed border-line py-2 text-step--1 font-bold text-primary"
          >
            Add a section
          </button>
        </aside>
      ) : null}
    </>
  )
}

/** Block-type chooser, grouped the same way as the admin block library. */
function SectionPicker({ onPick, onClose }: { onPick: (type: BlockType) => void; onClose: () => void }) {
  const categories = Array.from(new Set(BLOCK_LIBRARY.map((entry) => entry.category)))

  return (
    <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a section to add"
        className="max-h-[75vh] w-full max-w-2xl overflow-y-auto rounded-card border border-line bg-surface p-6 shadow-card"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-step-1 font-extrabold">Add a section</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-control border border-line px-3 py-1.5 text-step--1 font-bold"
          >
            Cancel
          </button>
        </div>

        {categories.map((category) => (
          <section key={category} className="mb-5">
            <h3 className="mb-2 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-subtle">{category}</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {BLOCK_LIBRARY.filter((entry) => entry.category === category).map((entry) => (
                <li key={entry.type}>
                  <button
                    type="button"
                    onClick={() => onPick(entry.type)}
                    className="w-full rounded-control border border-line px-3 py-2 text-left transition hover:border-primary hover:bg-surface-alt"
                  >
                    <span className="block text-step--1 font-bold">{entry.label}</span>
                    <span className="mt-0.5 block text-step--1 leading-snug text-subtle">{entry.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

function ControlButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'rounded-control px-1.5 py-1 text-step--1 leading-none transition hover:bg-surface-alt disabled:opacity-30',
        danger && 'text-danger',
      )}
    >
      {children}
    </button>
  )
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Finds `before` anywhere in the props tree and replaces it with `after`. */
function replaceStringDeep(node: unknown, before: string, after: string): boolean {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      if (typeof node[i] === 'string') {
        if (stripHtml(String(node[i])) === before) {
          node[i] = after
          return true
        }
      } else if (replaceStringDeep(node[i], before, after)) {
        return true
      }
    }
    return false
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>
    for (const key of Object.keys(obj)) {
      const value = obj[key]
      if (typeof value === 'string') {
        if (stripHtml(value) === before) {
          obj[key] = after
          return true
        }
      } else if (replaceStringDeep(value, before, after)) {
        return true
      }
    }
  }
  return false
}
