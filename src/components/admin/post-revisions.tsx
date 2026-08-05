'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Revision {
  id: string
  note: string | null
  author: string
  createdAt: string
  title: string
  status: string
  words: number
}

/**
 * Post revision history.
 *
 * A snapshot is written on every save, so this is the undo trail. Restoring
 * snapshots the current state first, which means a restore is itself undoable.
 */
export function PostRevisions({ postId, onMessage }: { postId: string; onMessage: (message: string) => void }) {
  const router = useRouter()
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/posts/${postId}/revisions`)
      const body = (await res.json()) as { ok: boolean; data?: Revision[] }
      setRevisions(body.ok ? (body.data ?? []) : [])
    } catch {
      setRevisions([])
    }
    setLoading(false)
  }, [postId])

  useEffect(() => {
    void load()
  }, [load])

  async function restore(revisionId: string) {
    if (!window.confirm('Restore this revision? The current version is snapshotted first, so this is undoable.')) return
    setBusy(true)
    const res = await fetch(`/api/admin/posts/${postId}/revisions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revisionId }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }
    setBusy(false)

    if (!body.ok) {
      onMessage(body.error ?? 'Restore failed.')
      return
    }
    onMessage('Revision restored. Reload to see the restored body.')
    void load()
    router.refresh()
  }

  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-step-0 font-extrabold">Revisions</h2>
        <button type="button" onClick={() => void load()} className="text-step--1 font-bold text-primary hover:underline">
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-step--1 text-muted">Loading…</p>
      ) : revisions.length === 0 ? (
        <p className="text-step--1 text-muted">
          No revisions yet. One is recorded automatically each time this post is saved.
        </p>
      ) : (
        <ol className="space-y-2">
          {revisions.map((revision) => (
            <li key={revision.id} className="rounded-control border border-line p-3">
              <p className="text-step--1 font-bold">{new Date(revision.createdAt).toLocaleString()}</p>
              <p className="mt-0.5 text-step--1 text-muted">
                {revision.author} · {revision.words} words
                {revision.status ? ` · ${revision.status}` : ''}
              </p>
              {revision.note ? <p className="mt-1 text-step--1 text-subtle">{revision.note}</p> : null}
              <button
                type="button"
                onClick={() => void restore(revision.id)}
                disabled={busy}
                className="mt-2 text-step--1 font-bold text-primary hover:underline disabled:opacity-50"
              >
                Restore this version
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
