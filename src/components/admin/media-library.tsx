'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Text } from '@/components/admin/props-inspector'

export interface MediaItem {
  id: string
  path: string
  filename: string
  alt: string
  decorative: boolean
  title: string
  caption: string
  width: number | null
  height: number | null
  bytes: number | null
  mimeType: string
}

interface Usage {
  kind: string
  label: string
  href: string
}

export function MediaLibrary({ initial, query }: { initial: MediaItem[]; query: string }) {
  const router = useRouter()
  const [selected, setSelected] = useState<MediaItem | null>(null)
  const [usages, setUsages] = useState<Usage[] | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadAlt, setUploadAlt] = useState('')
  const [uploadDecorative, setUploadDecorative] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  async function upload(files: FileList | null) {
    if (!files?.length) return
    if (!uploadAlt.trim() && !uploadDecorative) {
      setMessage('Add alt text before uploading, or tick "decorative".')
      return
    }
    setBusy(true)
    setMessage(`Uploading ${files.length} file(s)…`)

    const data = new FormData()
    for (const file of Array.from(files)) data.append('files', file)
    data.append('alt', uploadAlt)
    data.append('decorative', String(uploadDecorative))

    const res = await fetch('/api/admin/media', { method: 'POST', body: data })
    const body = (await res.json()) as { ok: boolean; error?: string }

    setBusy(false)
    setMessage(body.ok ? 'Uploaded.' : (body.error ?? 'Upload failed.'))
    if (body.ok) {
      setUploadAlt('')
      if (fileInput.current) fileInput.current.value = ''
      router.refresh()
    }
  }

  async function open(item: MediaItem) {
    setSelected(item)
    setUsages(null)
    const res = await fetch(`/api/admin/media/${item.id}`)
    const body = (await res.json()) as { ok: boolean; data?: { usages: Usage[] } }
    setUsages(body.data?.usages ?? [])
  }

  async function saveSelected() {
    if (!selected) return
    setBusy(true)
    const res = await fetch(`/api/admin/media/${selected.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        alt: selected.alt,
        decorative: selected.decorative,
        title: selected.title || null,
        caption: selected.caption || null,
      }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }
    setBusy(false)
    setMessage(body.ok ? 'Saved.' : (body.error ?? 'Save failed.'))
    if (body.ok) router.refresh()
  }

  async function remove(force = false) {
    if (!selected) return
    if (!window.confirm(`Delete ${selected.filename}? The file is removed from disk as well.`)) return
    const res = await fetch(`/api/admin/media/${selected.id}${force ? '?force=true' : ''}`, { method: 'DELETE' })
    const body = (await res.json()) as { ok: boolean; error?: string }
    if (!body.ok) {
      setMessage(`${body.error ?? 'Delete failed.'}${force ? '' : ' Use "delete anyway" to override.'}`)
      return
    }
    setMessage('Deleted.')
    setSelected(null)
    router.refresh()
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        <section className="mb-6 rounded-card border border-line bg-surface p-5">
          <h2 className="text-step-1">Upload</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Text label="Alt text for these files" value={uploadAlt} onChange={setUploadAlt} help="Required. Describe what the image shows." />
            <label className="flex items-end gap-3 pb-2 text-step--1 font-semibold">
              <input
                type="checkbox"
                checked={uploadDecorative}
                onChange={(e) => setUploadDecorative(e.target.checked)}
                className="h-[18px] w-[18px] accent-[var(--color-primary)]"
              />
              Decorative — carries no information
            </label>
          </div>
          <div className="mt-4">
            <label htmlFor="media-files" className="kc-label">
              Files
            </label>
            <input
              ref={fileInput}
              id="media-files"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
              onChange={(e) => void upload(e.target.files)}
              disabled={busy}
              className="kc-field"
            />
          </div>
          <p role="status" aria-live="polite" className={message ? 'mt-3 text-step--1 text-muted' : 'sr-only'}>
            {message}
          </p>
        </section>

        <form method="get" className="mb-5 flex gap-3">
          <label htmlFor="media-q" className="sr-only">
            Search media
          </label>
          <input id="media-q" name="q" defaultValue={query} placeholder="Search by filename, alt or caption" className="kc-field" />
          <button type="submit" className="kc-btn kc-btn-primary !px-5 !py-3">
            Search
          </button>
        </form>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {initial.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => void open(item)}
                className={cn(
                  'w-full overflow-hidden rounded-card border bg-surface text-left transition',
                  selected?.id === item.id ? 'border-primary shadow-card' : 'border-line hover:border-primary',
                )}
              >
                <Image
                  src={item.path}
                  alt={item.alt || item.filename}
                  width={item.width ?? 320}
                  height={item.height ?? 220}
                  className="h-28 w-full object-cover"
                />
                <span className="block truncate px-3 py-2 text-step--1 font-semibold">{item.filename}</span>
                {!item.alt && !item.decorative ? (
                  <span className="block px-3 pb-2 text-[0.68rem] font-bold uppercase text-danger">No alt text</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <aside className="rounded-card border border-line bg-surface p-5 xl:sticky xl:top-24 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
        {selected ? (
          <>
            <h2 className="text-step-1">{selected.filename}</h2>
            <Image
              src={selected.path}
              alt={selected.alt || selected.filename}
              width={selected.width ?? 480}
              height={selected.height ?? 320}
              className="mt-4 w-full rounded-control border border-line object-contain"
            />
            <dl className="mt-3 space-y-1 text-step--1 text-muted">
              <div className="flex gap-2">
                <dt className="font-semibold">Path:</dt>
                <dd className="truncate font-mono">{selected.path}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">Size:</dt>
                <dd>
                  {selected.width ?? '?'} × {selected.height ?? '?'} ·{' '}
                  {selected.bytes ? `${Math.round(selected.bytes / 1024)} KB` : 'unknown'}
                </dd>
              </div>
            </dl>

            <div className="mt-5 space-y-4">
              <Text label="Alt text" value={selected.alt} onChange={(v) => setSelected({ ...selected, alt: v })} multiline />
              <label className="flex items-center gap-3 text-step--1 font-semibold">
                <input
                  type="checkbox"
                  checked={selected.decorative}
                  onChange={(e) => setSelected({ ...selected, decorative: e.target.checked, alt: e.target.checked ? '' : selected.alt })}
                  className="h-[18px] w-[18px] accent-[var(--color-primary)]"
                />
                Decorative
              </label>
              <Text label="Title" value={selected.title} onChange={(v) => setSelected({ ...selected, title: v })} />
              <Text label="Caption" value={selected.caption} onChange={(v) => setSelected({ ...selected, caption: v })} multiline />
            </div>

            <div className="mt-5">
              <h3 className="text-step-0 font-extrabold">Used in</h3>
              {usages === null ? (
                <p className="mt-2 text-step--1 text-muted">Checking…</p>
              ) : usages.length === 0 ? (
                <p className="mt-2 text-step--1 text-muted">Not referenced anywhere.</p>
              ) : (
                <ul className="mt-2 space-y-1.5 text-step--1">
                  {usages.map((usage, i) => (
                    <li key={`${usage.href}-${i}`}>
                      <span className="text-subtle">{usage.kind}:</span>{' '}
                      <a href={usage.href} className="font-bold text-primary hover:underline">
                        {usage.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => void saveSelected()} disabled={busy} className="kc-btn kc-btn-primary !px-4 !py-2.5">
                Save
              </button>
              <button type="button" onClick={() => void remove(false)} className="kc-btn kc-btn-outline !px-4 !py-2.5">
                Delete
              </button>
              {usages && usages.length > 0 ? (
                <button type="button" onClick={() => void remove(true)} className="text-step--1 font-bold text-danger underline">
                  Delete anyway
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-step--1 text-muted">Select an asset to edit its alt text, caption and usage.</p>
        )}
      </aside>
    </div>
  )
}
