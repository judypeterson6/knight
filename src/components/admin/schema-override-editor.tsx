'use client'

import { useEffect, useState } from 'react'

/**
 * Raw JSON-LD override for one entity.
 *
 * Appending is the default: the supplied nodes are added to the graph this site
 * already generates (Organization, Service/Product/BlogPosting, BreadcrumbList,
 * FAQPage). "Replace" suppresses the generated graph entirely, which is
 * occasionally what you want and usually not.
 */
export function SchemaOverrideEditor({
  entityType,
  entityId,
  onMessage,
}: {
  entityType: 'PAGE' | 'POST' | 'COACH' | 'CATEGORY' | 'LOCATION'
  entityId: string
  onMessage: (message: string) => void
}) {
  const [json, setJson] = useState('')
  const [replace, setReplace] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [exists, setExists] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/schema-override?entityType=${entityType}&entityId=${entityId}`)
      .then((r) => r.json() as Promise<{ ok: boolean; data: { jsonLd: unknown; replace: boolean; enabled: boolean } | null }>)
      .then((body) => {
        if (cancelled || !body.ok || !body.data) return
        setJson(JSON.stringify(body.data.jsonLd, null, 2))
        setReplace(body.data.replace)
        setEnabled(body.data.enabled)
        setExists(true)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [entityType, entityId])

  function validate(value: string): unknown | null {
    if (!value.trim()) {
      setError('Enter a JSON-LD object, or an array of objects.')
      return null
    }
    try {
      const parsed = JSON.parse(value)
      setError(null)
      return parsed
    } catch (e) {
      setError(`Not valid JSON: ${(e as Error).message}`)
      return null
    }
  }

  async function save() {
    const parsed = validate(json)
    if (parsed === null) return

    setBusy(true)
    const res = await fetch('/api/admin/schema-override', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entityType, entityId, jsonLd: parsed, replace, enabled }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }
    setBusy(false)

    if (!body.ok) {
      setError(body.error ?? 'Save failed.')
      return
    }
    setError(null)
    setExists(true)
    onMessage('Schema override saved.')
  }

  async function remove() {
    if (!window.confirm('Remove the override? The generated graph will apply again.')) return
    setBusy(true)
    await fetch(`/api/admin/schema-override?entityType=${entityType}&entityId=${entityId}`, { method: 'DELETE' })
    setBusy(false)
    setJson('')
    setExists(false)
    setReplace(false)
    onMessage('Override removed — the generated graph applies again.')
  }

  return (
    <section className="space-y-4 rounded-card border border-line bg-surface p-6">
      <div>
        <h2 className="text-step-1">Raw JSON-LD override</h2>
        <p className="mt-1.5 text-step--1 text-muted">
          Anything you put here is added to the graph this page already generates. Null and empty values are stripped
          before output, the same as generated nodes.
        </p>
      </div>

      <div>
        <label htmlFor="schema-json" className="kc-label">
          JSON-LD
        </label>
        <textarea
          id="schema-json"
          rows={12}
          value={json}
          onChange={(e) => {
            setJson(e.target.value)
            if (error) setError(null)
          }}
          onBlur={() => json.trim() && validate(json)}
          spellCheck={false}
          placeholder={'{\n  "@type": "HowTo",\n  "name": "How to book an entertainer coach"\n}'}
          className="kc-field resize-y font-mono text-step--1"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'schema-json-error' : undefined}
        />
        {error ? (
          <p id="schema-json-error" role="alert" className="mt-1.5 text-step--1 font-bold text-danger">
            {error}
          </p>
        ) : (
          <p className="mt-1.5 text-step--1 text-subtle">
            One object, or an array of objects. Each needs an <code>@type</code>. Do not include{' '}
            <code>@context</code> — it is added for you.
          </p>
        )}
      </div>

      <label className="flex items-center gap-3 text-step--1 font-semibold">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-[18px] w-[18px] accent-[var(--color-primary)]"
        />
        Enabled
      </label>

      <label className="flex items-start gap-3 text-step--1 font-semibold">
        <input
          type="checkbox"
          checked={replace}
          onChange={(e) => setReplace(e.target.checked)}
          className="mt-0.5 h-[18px] w-[18px] accent-[var(--color-primary)]"
        />
        <span>
          Replace the generated graph entirely
          <span className="mt-1 block font-normal text-subtle">
            Leaves this page with only the JSON-LD above — no Organization, breadcrumbs or FAQ schema. Rarely what you
            want.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void save()} disabled={busy} className="kc-btn kc-btn-primary !px-5 !py-2.5">
          {busy ? 'Saving…' : 'Save override'}
        </button>
        {exists ? (
          <button type="button" onClick={() => void remove()} disabled={busy} className="kc-btn kc-btn-outline !px-5 !py-2.5">
            Remove override
          </button>
        ) : null}
      </div>
    </section>
  )
}
