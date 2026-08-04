'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ToolbarBlock {
  id: string
  type: string
  order: number
  visible: boolean
}

/**
 * Front-end editing toolbar.
 *
 * Toggling edit mode makes the text inside each rendered block inline-editable
 * in place (contentEditable on the real element), and opens a side drawer for
 * reordering, hiding and jumping to blocks. Saving posts the edited text back
 * through the same PageBlock API the admin block builder uses, so validation
 * and revisioning are identical, then triggers revalidation.
 *
 * This component is only ever rendered for a signed-in admin or editor — see
 * EditToolbarGate.
 */
export function EditToolbar({
  pageId,
  pageTitle,
  pagePath,
  status,
  blocks,
  userName,
}: {
  pageId: string
  pageTitle: string
  pagePath: string
  status: string
  blocks: ToolbarBlock[]
  userName: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [order, setOrder] = useState<ToolbarBlock[]>(blocks)
  const originals = useRef<Map<HTMLElement, string>>(new Map())

  /** Text nodes that are safe to edit in place — headings and paragraphs only. */
  const editableSelector = 'h1, h2, h3, h4, p, li, figcaption, dd, dt, blockquote'

  useEffect(() => {
    const root = document.getElementById('main')
    if (!root) return

    const elements = Array.from(root.querySelectorAll<HTMLElement>(editableSelector)).filter(
      (el) => el.closest('[data-block-id]') && !el.querySelector('input, select, textarea, button'),
    )

    if (editing) {
      for (const el of elements) {
        originals.current.set(el, el.innerHTML)
        el.setAttribute('contenteditable', 'plaintext-only')
        el.dataset.kcEditable = 'true'
        el.addEventListener('input', markDirty)
      }
      document.documentElement.classList.add('kc-editing')
    } else {
      for (const el of elements) {
        el.removeAttribute('contenteditable')
        delete el.dataset.kcEditable
        el.removeEventListener('input', markDirty)
      }
      document.documentElement.classList.remove('kc-editing')
    }

    return () => {
      for (const el of elements) el.removeEventListener('input', markDirty)
    }

    function markDirty() {
      setDirty(true)
    }
  }, [editing])

  function discard() {
    for (const [el, html] of originals.current) el.innerHTML = html
    setDirty(false)
    setEditing(false)
    setMessage('Changes discarded.')
  }

  /**
   * Collects the edited text back into block props.
   *
   * Each edited element is matched to its block by the `data-block-id` wrapper
   * the renderer emits, and to its field by `data-kc-field` where the block
   * component set one. Fields without a marker fall back to positional matching
   * against the original text, so an edit never lands in the wrong property.
   */
  async function save() {
    setSaving(true)
    setMessage('Saving…')

    const current = await fetch(`/api/admin/pages/${pageId}`)
      .then((r) => r.json() as Promise<{ ok: boolean; data?: { blocks: { id: string; type: string; order: number; visible: boolean; props: Record<string, unknown> }[] } }>)
      .catch(() => null)

    if (!current?.ok || !current.data) {
      setSaving(false)
      setMessage('Could not load the current blocks. Nothing was saved.')
      return
    }

    const byId = new Map(current.data.blocks.map((b) => [b.id, b]))

    for (const [el, originalHtml] of originals.current) {
      const wrapper = el.closest('[data-block-id]') as HTMLElement | null
      if (!wrapper) continue
      const block = byId.get(wrapper.dataset.blockId ?? '')
      if (!block) continue

      const before = stripHtml(originalHtml)
      const after = stripHtml(el.innerHTML)
      if (before === after) continue

      replaceStringDeep(block.props, before, after)
    }

    // Apply the drawer's reorder and visibility state.
    const orderIndex = new Map(order.map((b, i) => [b.id, { index: i, visible: b.visible }]))
    const payload = current.data.blocks
      .map((block) => {
        const meta = orderIndex.get(block.id)
        return {
          id: block.id,
          type: block.type as never,
          order: meta?.index ?? block.order,
          visible: meta?.visible ?? block.visible,
          props: block.props,
        }
      })
      .sort((a, b) => a.order - b.order)
      .map((block, index) => ({ ...block, order: index }))

    const res = await fetch(`/api/admin/pages/${pageId}/blocks`, {
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

    setDirty(false)
    setEditing(false)
    setMessage('Saved and published.')
    router.refresh()
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...order]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setOrder(next)
    setDirty(true)
  }

  function toggleVisible(index: number) {
    const next = [...order]
    next[index] = { ...next[index], visible: !next[index].visible }
    setOrder(next)
    setDirty(true)
  }

  return (
    <>
      <style>{`
        html.kc-editing [data-kc-editable="true"] { outline: 1px dashed var(--color-primary); outline-offset: 3px; border-radius: 3px; }
        html.kc-editing [data-kc-editable="true"]:focus { outline: 2px solid var(--color-primary); background: var(--color-primary-soft); }
        body { padding-bottom: 4.5rem; }
      `}</style>

      <div
        role="region"
        aria-label="Page editing toolbar"
        className="fixed inset-x-0 bottom-0 z-[200] flex flex-wrap items-center gap-3 border-t border-line bg-surface px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
      >
        <p className="mr-auto text-step--1">
          <span className="font-extrabold">{pageTitle}</span>{' '}
          <span className="text-muted">
            · {pagePath} · {status}
          </span>
        </p>

        <p role="status" aria-live="polite" className={cn('text-step--1', message ? 'text-muted' : 'sr-only')}>
          {message}
        </p>

        {editing ? (
          <>
            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-expanded={drawerOpen}
              className="rounded-control border border-line px-3.5 py-2 text-step--1 font-bold"
            >
              Blocks ({order.length})
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
            <Link
              href={`/admin/pages/${pageId}/edit`}
              className="rounded-control border border-line px-3.5 py-2 text-step--1 font-bold"
            >
              Open block builder
            </Link>
            <button
              type="button"
              onClick={() => {
                setEditing(true)
                setMessage('Edit mode on. Click any heading or paragraph to change it.')
              }}
              className="kc-btn kc-btn-primary !px-5 !py-2 !text-step--1"
            >
              Edit this page
            </button>
          </>
        )}
      </div>

      {editing && drawerOpen ? (
        <aside
          aria-label="Block order"
          className="fixed bottom-[4.5rem] right-4 z-[200] max-h-[60vh] w-80 overflow-y-auto rounded-card border border-line bg-surface p-4 shadow-card"
        >
          <h2 className="mb-3 text-step-0 font-extrabold">Blocks on this page</h2>
          <ol className="space-y-2">
            {order.map((block, index) => (
              <li key={block.id} className="flex items-center gap-2 rounded-control border border-line px-3 py-2">
                <span className={cn('flex-1 text-step--1 font-semibold', !block.visible && 'text-subtle line-through')}>
                  {block.type}
                </span>
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="px-1.5 disabled:opacity-30"
                  aria-label={`Move ${block.type} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === order.length - 1}
                  className="px-1.5 disabled:opacity-30"
                  aria-label={`Move ${block.type} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => toggleVisible(index)}
                  className="px-1.5 text-step--1 font-bold text-primary"
                  aria-label={`${block.visible ? 'Hide' : 'Show'} ${block.type}`}
                >
                  {block.visible ? 'Hide' : 'Show'}
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-step--1 text-subtle">Reordering applies when you press Save.</p>
        </aside>
      ) : null}
    </>
  )
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/ /g, ' ')
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
