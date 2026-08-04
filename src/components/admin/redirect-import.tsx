'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RedirectImport() {
  const router = useRouter()
  const [csv, setCsv] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function importCsv() {
    setBusy(true)
    setMessage('Importing…')
    const res = await fetch('/api/admin/redirects/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ csv }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string; data?: { imported: number; skipped: string[] } }
    setBusy(false)

    if (!body.ok) {
      setMessage(body.error ?? 'Import failed.')
      return
    }
    setMessage(
      `Imported ${body.data?.imported ?? 0} redirect(s)` +
        (body.data?.skipped.length ? `, skipped ${body.data.skipped.length}: ${body.data.skipped.slice(0, 3).join('; ')}` : '.'),
    )
    setCsv('')
    router.refresh()
  }

  return (
    <div>
      <label htmlFor="redirect-csv" className="kc-label">
        Paste CSV
      </label>
      <textarea
        id="redirect-csv"
        rows={6}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder={'from,to,kind\n/old-page,/new-page,PERMANENT'}
        className="kc-field resize-y font-mono text-step--1"
      />
      <p className="mt-1.5 text-step--1 text-subtle">
        Columns: from, to, and optionally kind. A header row is detected automatically. Existing sources are updated
        rather than duplicated, and a redirect that points at itself is skipped.
      </p>

      <p role="status" aria-live="polite" className={message ? 'mt-3 text-step--1 text-muted' : 'sr-only'}>
        {message}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => void importCsv()} disabled={busy || !csv.trim()} className="kc-btn kc-btn-primary !px-5 !py-2.5">
          {busy ? 'Importing…' : 'Import CSV'}
        </button>
        {/* A file download from an API route, not a page navigation. */}
        <a href="/api/admin/redirects/import" download className="kc-btn kc-btn-outline !px-5 !py-2.5">
          Export CSV
        </a>
      </div>
    </div>
  )
}
