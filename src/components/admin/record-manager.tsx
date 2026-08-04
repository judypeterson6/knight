'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn, slugify } from '@/lib/utils'

export interface FieldDef {
  name: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'slug' | 'media' | 'list'
  help?: string
  required?: boolean
  options?: { value: string; label: string }[]
  /** Derives the slug from this field when the slug is still empty. */
  slugFrom?: string
  /** Column in the list view. */
  inTable?: boolean
}

export type RecordRow = Record<string, unknown> & { id: string }

/**
 * Generic list + create/edit form for the simpler content types (FAQs,
 * testimonials, locations, categories, coach classes, redirects).
 *
 * The field definitions come from the server component that renders this, and
 * every write goes through the same guarded, Zod-validated API as everything
 * else — this is a UI convenience, not a bypass.
 */
export function RecordManager({
  endpoint,
  fields,
  records,
  singular,
  emptyBody,
}: {
  endpoint: string
  fields: FieldDef[]
  records: RecordRow[]
  singular: string
  emptyBody: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<RecordRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const tableFields = fields.filter((f) => f.inTable)

  function blank(): RecordRow {
    const record: Record<string, unknown> = { id: '' }
    for (const field of fields) {
      record[field.name] =
        field.type === 'checkbox' ? false : field.type === 'number' ? 0 : field.type === 'list' ? [] : ''
    }
    return record as RecordRow
  }

  async function save(record: RecordRow) {
    setBusy(true)
    setMessage('Saving…')

    const payload: Record<string, unknown> = {}
    for (const field of fields) {
      const value = record[field.name]
      if (field.type === 'number') payload[field.name] = Number(value) || 0
      else if (field.type === 'checkbox') payload[field.name] = Boolean(value)
      else if (field.type === 'list') payload[field.name] = Array.isArray(value) ? value : []
      else if (value === '' && !field.required) payload[field.name] = null
      else payload[field.name] = value
    }

    const isNew = !record.id
    const res = await fetch(isNew ? endpoint : `${endpoint}/${record.id}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }

    setBusy(false)
    if (!body.ok) {
      setMessage(body.error ?? 'Save failed.')
      return
    }
    setMessage(`${singular} saved.`)
    setEditing(null)
    setCreating(false)
    router.refresh()
  }

  async function remove(record: RecordRow) {
    if (!window.confirm(`Delete this ${singular.toLowerCase()}? This cannot be undone.`)) return
    const res = await fetch(`${endpoint}/${record.id}`, { method: 'DELETE' })
    const body = (await res.json()) as { ok: boolean; error?: string }
    setMessage(body.ok ? `${singular} deleted.` : (body.error ?? 'Delete failed.'))
    if (body.ok) router.refresh()
  }

  const active = creating ? blank() : editing

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => {
            setCreating(true)
            setEditing(null)
          }}
          className="kc-btn kc-btn-primary !px-5 !py-2.5"
        >
          New {singular.toLowerCase()}
        </button>
        <p role="status" aria-live="polite" className={message ? 'text-step--1 text-muted' : 'sr-only'}>
          {message}
        </p>
      </div>

      {active ? (
        <RecordForm
          key={active.id || 'new'}
          record={active}
          fields={fields}
          busy={busy}
          singular={singular}
          onCancel={() => {
            setEditing(null)
            setCreating(false)
          }}
          onSave={save}
        />
      ) : null}

      {records.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-surface-alt p-10 text-center text-muted">
          {emptyBody}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[42rem] border-collapse text-step--1">
            <thead>
              <tr className="bg-surface-alt text-left">
                {tableFields.map((field) => (
                  <th key={field.name} scope="col" className="border-b border-line px-4 py-3 font-bold">
                    {field.label}
                  </th>
                ))}
                <th scope="col" className="border-b border-line px-4 py-3 font-bold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-line last:border-0 hover:bg-surface-alt">
                  {tableFields.map((field) => (
                    <td key={field.name} className="max-w-md truncate px-4 py-3 align-middle">
                      {formatCell(record[field.name])}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(record)
                          setCreating(false)
                        }}
                        className="font-bold text-primary hover:underline"
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => void remove(record)} className="font-bold text-danger hover:underline">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return `${value.length} item(s)`
  if (typeof value === 'object') return '—'
  return String(value)
}

function RecordForm({
  record,
  fields,
  busy,
  singular,
  onSave,
  onCancel,
}: {
  record: RecordRow
  fields: FieldDef[]
  busy: boolean
  singular: string
  onSave: (record: RecordRow) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<RecordRow>(record)

  function set(name: string, value: unknown) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave(form)
      }}
      className="mb-8 space-y-4 rounded-card border border-primary bg-surface p-6"
    >
      <h2 className="text-step-1">{record.id ? `Edit ${singular.toLowerCase()}` : `New ${singular.toLowerCase()}`}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const id = `rf-${field.name}`
          const value = form[field.name]
          const wide = field.type === 'textarea' || field.type === 'list'

          return (
            <div key={field.name} className={cn(wide && 'sm:col-span-2')}>
              {field.type === 'checkbox' ? (
                <label htmlFor={id} className="flex items-center gap-3 text-step--1 font-semibold">
                  <input
                    id={id}
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => set(field.name, e.target.checked)}
                    className="h-[18px] w-[18px] accent-[var(--color-primary)]"
                  />
                  {field.label}
                </label>
              ) : (
                <>
                  <label htmlFor={id} className="kc-label">
                    {field.label}
                    {field.required ? (
                      <>
                        {' '}
                        <span className="text-danger" aria-hidden>
                          *
                        </span>
                        <span className="sr-only">(required)</span>
                      </>
                    ) : null}
                  </label>

                  {field.type === 'textarea' ? (
                    <textarea
                      id={id}
                      rows={4}
                      required={field.required}
                      value={String(value ?? '')}
                      onChange={(e) => set(field.name, e.target.value)}
                      className="kc-field resize-y"
                    />
                  ) : field.type === 'select' ? (
                    <select
                      id={id}
                      required={field.required}
                      value={String(value ?? '')}
                      onChange={(e) => set(field.name, e.target.value)}
                      className="kc-field"
                    >
                      <option value="">—</option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'list' ? (
                    <textarea
                      id={id}
                      rows={5}
                      value={(Array.isArray(value) ? value : []).join('\n')}
                      onChange={(e) => set(field.name, e.target.value.split('\n').filter((l) => l.trim()))}
                      className="kc-field resize-y"
                    />
                  ) : (
                    <input
                      id={id}
                      type={field.type === 'number' ? 'number' : 'text'}
                      required={field.required}
                      value={String(value ?? '')}
                      onChange={(e) => set(field.name, field.type === 'slug' ? slugify(e.target.value) : e.target.value)}
                      onBlur={() => {
                        // Fill an empty slug from its source field.
                        const slugField = fields.find((f) => f.type === 'slug' && f.slugFrom === field.name)
                        if (slugField && !form[slugField.name]) {
                          set(slugField.name, slugify(String(form[field.name] ?? '')))
                        }
                      }}
                      className="kc-field"
                    />
                  )}
                </>
              )}

              {field.help ? <p className="mt-1.5 text-step--1 text-subtle">{field.help}</p> : null}
            </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="kc-btn kc-btn-primary !px-5 !py-2.5">
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="kc-btn kc-btn-outline !px-5 !py-2.5">
          Cancel
        </button>
      </div>
    </form>
  )
}
