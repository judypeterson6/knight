'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface LogRow {
  id: string
  url: string
  provider: string
  action: string
  status: string
  code: number | null
  response: string | null
  attempts: number
  createdAt: string
}

export function IndexingConsole({
  logs,
  quota,
  configured,
  allUrls,
}: {
  logs: LogRow[]
  quota: { indexNow: { used: number; limit: number }; google: { used: number; limit: number } }
  configured: { indexNow: boolean; google: boolean }
  allUrls: string[]
}) {
  const router = useRouter()
  const [urls, setUrls] = useState('')
  const [providers, setProviders] = useState<string[]>(['INDEXNOW', 'SITEMAP_PING'])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  const failed = logs.filter((log) => log.status === 'FAILED')

  async function submit() {
    const list = urls
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter(Boolean)

    if (!list.length) {
      setMessage('Add at least one URL.')
      return
    }

    setBusy(true)
    setMessage('Submitting…')
    const res = await fetch('/api/admin/indexing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ urls: list, providers, action: 'URL_UPDATED' }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string; data?: { results: { provider: string; ok: boolean; message: string }[] } }
    setBusy(false)

    if (!body.ok) {
      setMessage(body.error ?? 'Submission failed.')
      return
    }
    setMessage(body.data?.results.map((r) => `${r.provider}: ${r.message}`).join(' · ') ?? 'Submitted.')
    router.refresh()
  }

  async function retry() {
    if (!selected.length) return
    setBusy(true)
    const res = await fetch('/api/admin/indexing/retry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: selected }),
    })
    const body = (await res.json()) as { ok: boolean; data?: { retried: number } }
    setBusy(false)
    setMessage(body.ok ? `Retried ${body.data?.retried ?? 0} row(s).` : 'Retry failed.')
    setSelected([])
    router.refresh()
  }

  return (
    <>
      <dl className="mb-6 grid gap-4 sm:grid-cols-2">
        {(
          [
            ['IndexNow', quota.indexNow, configured.indexNow, 'INDEXNOW_KEY'],
            ['Google Indexing API', quota.google, configured.google, 'GOOGLE_INDEXING_SA_JSON'],
          ] as const
        ).map(([name, values, isConfigured, envVar]) => (
          <div key={name} className="rounded-card border border-line bg-surface p-5">
            <dt className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-muted">{name}</dt>
            <dd className="mt-2 text-[1.6rem] font-extrabold leading-none">
              {values.used}
              <span className="text-step-0 font-semibold text-muted"> / {values.limit} today</span>
            </dd>
            <p className={cn('mt-2 text-step--1 font-semibold', isConfigured ? 'text-muted' : 'text-danger')}>
              {isConfigured ? 'Configured' : `Not configured — set ${envVar}`}
            </p>
          </div>
        ))}
      </dl>

      <section className="mb-8 rounded-card border border-line bg-surface p-6">
        <h2 className="text-step-1">Submit URLs</h2>

        <div className="mt-4">
          <label htmlFor="indexing-urls" className="kc-label">
            URLs (one per line)
          </label>
          <textarea
            id="indexing-urls"
            rows={6}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="/fleet&#10;/entertainer-coach"
            className="kc-field resize-y font-mono text-step--1"
          />
          <button
            type="button"
            onClick={() => setUrls(allUrls.join('\n'))}
            className="mt-2 text-step--1 font-bold text-primary underline"
          >
            Fill with all {allUrls.length} published URLs
          </button>
        </div>

        <fieldset className="mt-4">
          <legend className="kc-label">Providers</legend>
          <div className="flex flex-wrap gap-5">
            {(
              [
                ['INDEXNOW', 'IndexNow'],
                ['GOOGLE', 'Google Indexing API'],
                ['SITEMAP_PING', 'Sitemap ping'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2.5 text-step--1 font-semibold">
                <input
                  type="checkbox"
                  checked={providers.includes(value)}
                  onChange={(e) =>
                    setProviders(e.target.checked ? [...providers, value] : providers.filter((p) => p !== value))
                  }
                  className="h-[18px] w-[18px] accent-[var(--color-primary)]"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <p role="status" aria-live="polite" className={message ? 'mt-4 text-step--1 text-muted' : 'sr-only'}>
          {message}
        </p>

        <button type="button" onClick={() => void submit()} disabled={busy} className="kc-btn kc-btn-primary mt-5 !px-5 !py-2.5">
          {busy ? 'Submitting…' : 'Submit'}
        </button>
      </section>

      <section className="rounded-card border border-line bg-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-step-1">Recent submissions</h2>
          {failed.length ? (
            <button
              type="button"
              onClick={() => void retry()}
              disabled={busy || selected.length === 0}
              className="kc-btn kc-btn-outline !px-4 !py-2.5 !text-step--1 disabled:opacity-50"
            >
              Retry selected ({selected.length})
            </button>
          ) : null}
        </div>

        {logs.length === 0 ? (
          <p className="text-step--1 text-muted">Nothing submitted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-step--1">
              <thead>
                <tr className="bg-surface-alt text-left">
                  <th scope="col" className="border-b border-line px-3 py-2">
                    <span className="sr-only">Select</span>
                  </th>
                  {['URL', 'Provider', 'Action', 'Status', 'Code', 'Attempts', 'When'].map((h) => (
                    <th key={h} scope="col" className="border-b border-line px-3 py-2 font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">
                      {log.status === 'FAILED' ? (
                        <>
                          <input
                            id={`sel-${log.id}`}
                            type="checkbox"
                            checked={selected.includes(log.id)}
                            onChange={(e) =>
                              setSelected(e.target.checked ? [...selected, log.id] : selected.filter((id) => id !== log.id))
                            }
                            className="h-4 w-4 accent-[var(--color-primary)]"
                          />
                          <label htmlFor={`sel-${log.id}`} className="sr-only">
                            Select {log.url} for retry
                          </label>
                        </>
                      ) : null}
                    </td>
                    <td className="max-w-[18rem] truncate px-3 py-2 text-muted" title={log.response ?? undefined}>
                      {log.url}
                    </td>
                    <td className="px-3 py-2">{log.provider}</td>
                    <td className="px-3 py-2 text-muted">{log.action}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'rounded-pill px-2 py-0.5 text-[0.68rem] font-extrabold uppercase',
                          log.status === 'SUCCESS' ? 'bg-success/15 text-[color:var(--color-success)]' : 'bg-danger/10 text-danger',
                        )}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted">{log.code ?? '—'}</td>
                    <td className="px-3 py-2 text-muted">{log.attempts}</td>
                    <td className="px-3 py-2 text-subtle">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
