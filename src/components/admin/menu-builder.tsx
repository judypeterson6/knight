'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface MenuItemDraft {
  id: string
  parentId: string | null
  kind: string
  label: string
  url: string
  column: number | null
  order: number
  rel: string | null
  target: string | null
  visible: boolean
  isCta: boolean
}

interface Target {
  group: string
  label: string
  url: string
}

export function MenuBuilder({
  location,
  initial,
  targets,
  showColumns,
}: {
  location: 'HEADER' | 'FOOTER'
  initial: MenuItemDraft[]
  targets: Target[]
  showColumns: boolean
}) {
  const router = useRouter()
  const [items, setItems] = useState<MenuItemDraft[]>(initial)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const groups = [...new Set(targets.map((t) => t.group))]

  function update(index: number, patch: Partial<MenuItemDraft>) {
    const next = [...items]
    next[index] = { ...next[index], ...patch }
    setItems(next)
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    setItems(next.map((item, i) => ({ ...item, order: i })))
  }

  function add() {
    setItems([
      ...items,
      {
        id: `new-${items.length}-${Date.now() % 100000}`,
        parentId: null,
        kind: 'CUSTOM',
        label: 'New item',
        url: '/',
        column: showColumns ? 1 : null,
        order: items.length,
        rel: null,
        target: null,
        visible: true,
        isCta: false,
      },
    ])
  }

  async function save() {
    setBusy(true)
    setMessage('Saving…')

    const res = await fetch(`/api/admin/menus/${location.toLowerCase()}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: items.map((item, i) => ({ ...item, order: i })) }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }

    setBusy(false)
    setMessage(body.ok ? 'Menu saved and the site header/footer revalidated.' : (body.error ?? 'Save failed.'))
    if (body.ok) router.refresh()
  }

  return (
    <div>
      <ol className="space-y-2">
        {items.map((item, index) => {
          const parentOptions = items.filter((candidate) => candidate.id !== item.id && !candidate.parentId)
          return (
            <li
              key={item.id}
              className={cn(
                'rounded-card border border-line bg-surface p-3',
                item.parentId && 'ml-8 border-l-4 border-l-primary/40',
                !item.visible && 'opacity-60',
              )}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label htmlFor={`label-${item.id}`} className="kc-label">
                    Label
                  </label>
                  <input id={`label-${item.id}`} value={item.label} onChange={(e) => update(index, { label: e.target.value })} className="kc-field" />
                </div>

                <div>
                  <label htmlFor={`url-${item.id}`} className="kc-label">
                    URL
                  </label>
                  <input id={`url-${item.id}`} value={item.url} onChange={(e) => update(index, { url: e.target.value })} className="kc-field" list={`targets-${location}`} />
                </div>

                <div>
                  <label htmlFor={`parent-${item.id}`} className="kc-label">
                    Parent
                  </label>
                  <select
                    id={`parent-${item.id}`}
                    value={item.parentId ?? ''}
                    onChange={(e) => update(index, { parentId: e.target.value || null })}
                    className="kc-field"
                  >
                    <option value="">Top level</option>
                    {parentOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {showColumns ? (
                  <div>
                    <label htmlFor={`column-${item.id}`} className="kc-label">
                      Footer column
                    </label>
                    <input
                      id={`column-${item.id}`}
                      type="number"
                      min={1}
                      max={6}
                      value={item.column ?? 1}
                      onChange={(e) => update(index, { column: Number(e.target.value) || 1 })}
                      className="kc-field"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor={`rel-${item.id}`} className="kc-label">
                      rel
                    </label>
                    <input id={`rel-${item.id}`} value={item.rel ?? ''} onChange={(e) => update(index, { rel: e.target.value || null })} className="kc-field" />
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-step--1 font-semibold">
                  <input type="checkbox" checked={item.visible} onChange={(e) => update(index, { visible: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />
                  Visible
                </label>
                {!showColumns ? (
                  <label className="flex items-center gap-2 text-step--1 font-semibold">
                    <input type="checkbox" checked={item.isCta} onChange={(e) => update(index, { isCta: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />
                    Phone CTA treatment
                  </label>
                ) : null}
                <label className="flex items-center gap-2 text-step--1 font-semibold">
                  <input
                    type="checkbox"
                    checked={item.target === '_blank'}
                    onChange={(e) => update(index, { target: e.target.checked ? '_blank' : null })}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  Open in a new tab
                </label>

                <div className="ml-auto flex gap-2">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="px-2 disabled:opacity-30" aria-label={`Move ${item.label} up`}>
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    className="px-2 disabled:opacity-30"
                    aria-label={`Move ${item.label} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, i) => i !== index).map((it, i) => ({ ...it, order: i })))}
                    className="px-2 text-danger"
                    aria-label={`Delete ${item.label}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <datalist id={`targets-${location}`}>
        {groups.flatMap((group) =>
          targets
            .filter((t) => t.group === group)
            .map((target) => <option key={`${group}-${target.url}`} value={target.url} label={`${group}: ${target.label}`} />),
        )}
      </datalist>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="button" onClick={add} className="kc-btn kc-btn-outline !px-5 !py-2.5">
          Add item
        </button>
        <button type="button" onClick={() => void save()} disabled={busy} className="kc-btn kc-btn-primary !px-5 !py-2.5">
          {busy ? 'Saving…' : 'Save menu'}
        </button>
        <p role="status" aria-live="polite" className={message ? 'text-step--1 text-muted' : 'sr-only'}>
          {message}
        </p>
      </div>
    </div>
  )
}
