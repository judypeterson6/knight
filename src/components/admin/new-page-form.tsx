'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { slugify } from '@/lib/utils'
import { Text } from '@/components/admin/props-inspector'

const PAGE_TYPES: { value: string; label: string; hint: string }[] = [
  { value: 'service', label: 'Service', hint: 'H1, service statement, action block, trust strip, then service cards, fleet preview, differentiators, steps, coverage, FAQ.' },
  { value: 'location', label: 'Location', hint: 'H1 with service and area, coverage statement, pickup city list, quote CTA, then markets, routes, local considerations, FAQ.' },
  { value: 'fleet-listing', label: 'Fleet listing', hint: 'H1, selection criteria, working filters, then the grid, comparison table, spec glossary, FAQ.' },
  { value: 'about', label: 'About', hint: 'AboutPage schema.' },
  { value: 'contact', label: 'Contact', hint: 'ContactPage schema, form, address, phone, map.' },
  { value: 'legal', label: 'Legal', hint: 'Long-form prose.' },
  { value: 'home', label: 'Home', hint: 'The full landing stack. Normally only one page uses this.' },
]

export function NewPageForm() {
  const router = useRouter()
  const [form, setForm] = useState({ title: '', slug: '', path: '', pageType: 'service', status: 'DRAFT' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedType = PAGE_TYPES.find((t) => t.value === form.pageType)

  async function create() {
    setBusy(true)
    setMessage('Creating…')

    const res = await fetch('/api/admin/pages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    const body = (await res.json()) as { ok: boolean; error?: string; data?: { id: string } }

    setBusy(false)
    if (!body.ok || !body.data) {
      setMessage(body.error ?? 'Create failed.')
      return
    }
    router.push(`/admin/pages/${body.data.id}/edit`)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void create()
      }}
      className="max-w-2xl space-y-5 rounded-card border border-line bg-surface p-6"
    >
      <Text
        label="Title"
        value={form.title}
        onChange={(v) => {
          const slug = slugify(v)
          setForm({ ...form, title: v, slug, path: form.path || (slug ? `/${slug}` : '') })
        }}
      />
      <Text label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: slugify(v) })} />
      <Text
        label="Path"
        value={form.path}
        onChange={(v) => setForm({ ...form, path: v })}
        help="Leading slash, no trailing slash. Nested paths are fine, e.g. /entertainer-coach/leasing."
      />

      <div>
        <label htmlFor="new-page-type" className="kc-label">
          Page type
        </label>
        <select id="new-page-type" value={form.pageType} onChange={(e) => setForm({ ...form, pageType: e.target.value })} className="kc-field">
          {PAGE_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        {selectedType ? <p className="mt-1.5 text-step--1 text-subtle">{selectedType.hint}</p> : null}
      </div>

      <div>
        <label htmlFor="new-page-status" className="kc-label">
          Status
        </label>
        <select id="new-page-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="kc-field">
          {['DRAFT', 'PUBLISHED'].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <p role="status" aria-live="polite" className={message ? 'text-step--1 text-muted' : 'sr-only'}>
        {message}
      </p>

      <button type="submit" disabled={busy} className="kc-btn kc-btn-primary !px-5 !py-2.5">
        {busy ? 'Creating…' : 'Create page and open the builder'}
      </button>
    </form>
  )
}
