'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  name: string
  email: string
  phone: string | null
  subject: string | null
  message: string
  read: boolean
  starred: boolean
  createdAt: string
}

interface Submission {
  id: string
  formName: string
  data: Record<string, string>
  emailed: boolean
  emailError: string | null
  createdAt: string
}

export function Inbox({
  messages,
  submissions,
  query,
  filter,
}: {
  messages: Message[]
  submissions: Submission[]
  query: string
  filter: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'messages' | 'submissions'>('messages')
  const [open, setOpen] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  async function patch(id: string, patchBody: Record<string, boolean>) {
    const res = await fetch(`/api/admin/inbox/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patchBody),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }
    if (body.ok) router.refresh()
    else setMessage(body.error ?? 'Update failed.')
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this message? This cannot be undone.')) return
    const res = await fetch(`/api/admin/inbox/${id}`, { method: 'DELETE' })
    const body = (await res.json()) as { ok: boolean; error?: string }
    if (body.ok) router.refresh()
    else setMessage(body.error ?? 'Delete failed.')
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <nav aria-label="Inbox sections" className="flex gap-2">
          {(
            [
              ['messages', `Messages (${messages.length})`],
              ['submissions', `Raw submissions (${submissions.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={tab === key ? 'true' : undefined}
              className={cn(
                'rounded-pill px-4 py-2 text-step--1 font-bold',
                tab === key ? 'bg-primary text-primary-contrast' : 'bg-surface text-muted',
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* A file download from an API route, not a page navigation — next/link
            would prefetch it and would not honour the download attribute. */}
        <a href="/api/admin/submissions/export" download className="kc-btn kc-btn-outline !px-4 !py-2.5 !text-step--1">
          Export CSV
        </a>

        <p role="status" aria-live="polite" className={message ? 'text-step--1 text-danger' : 'sr-only'}>
          {message}
        </p>
      </div>

      {tab === 'messages' ? (
        <>
          <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1">
              <label htmlFor="inbox-q" className="kc-label">
                Search
              </label>
              <input id="inbox-q" name="q" defaultValue={query} placeholder="Name, email or message" className="kc-field" />
            </div>
            <div>
              <label htmlFor="inbox-filter" className="kc-label">
                Show
              </label>
              <select id="inbox-filter" name="filter" defaultValue={filter} className="kc-field">
                <option value="all">All</option>
                <option value="unread">Unread</option>
                <option value="starred">Starred</option>
              </select>
            </div>
            <button type="submit" className="kc-btn kc-btn-primary !px-5 !py-3">
              Filter
            </button>
          </form>

          {messages.length === 0 ? (
            <p className="rounded-card border border-dashed border-line bg-surface-alt p-10 text-center text-muted">
              No messages match.
            </p>
          ) : (
            <ul className="space-y-2">
              {messages.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'rounded-card border bg-surface',
                    item.read ? 'border-line' : 'border-primary/50 bg-primary-soft/30',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-3 p-4">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(open === item.id ? null : item.id)
                        if (!item.read) void patch(item.id, { read: true })
                      }}
                      aria-expanded={open === item.id}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block font-bold">
                        {item.name} <span className="font-normal text-muted">· {item.email}</span>
                      </span>
                      <span className="block truncate text-step--1 text-muted">
                        {item.subject ? `${item.subject} — ` : ''}
                        {item.message.slice(0, 120)}
                      </span>
                    </button>

                    <time dateTime={item.createdAt} className="text-step--1 text-subtle">
                      {new Date(item.createdAt).toLocaleString()}
                    </time>

                    <button
                      type="button"
                      onClick={() => void patch(item.id, { starred: !item.starred })}
                      className={cn('px-2 text-lg', item.starred ? 'text-primary' : 'text-subtle')}
                      aria-label={item.starred ? `Unstar message from ${item.name}` : `Star message from ${item.name}`}
                    >
                      {item.starred ? '★' : '☆'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void patch(item.id, { read: !item.read })}
                      className="text-step--1 font-bold text-primary"
                    >
                      Mark {item.read ? 'unread' : 'read'}
                    </button>
                    <a href={`mailto:${item.email}`} className="text-step--1 font-bold text-primary hover:underline">
                      Reply
                    </a>
                    <button type="button" onClick={() => void remove(item.id)} className="text-step--1 font-bold text-danger">
                      Delete
                    </button>
                  </div>

                  {open === item.id ? (
                    <div className="border-t border-line p-4">
                      <dl className="mb-3 grid gap-2 text-step--1 sm:grid-cols-3">
                        <div>
                          <dt className="font-bold">Email</dt>
                          <dd className="text-muted">{item.email}</dd>
                        </div>
                        {item.phone ? (
                          <div>
                            <dt className="font-bold">Phone</dt>
                            <dd className="text-muted">{item.phone}</dd>
                          </div>
                        ) : null}
                        {item.subject ? (
                          <div>
                            <dt className="font-bold">Subject</dt>
                            <dd className="text-muted">{item.subject}</dd>
                          </div>
                        ) : null}
                      </dl>
                      <p className="whitespace-pre-wrap text-step--1 leading-relaxed text-muted">{item.message}</p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <ul className="space-y-2">
          {submissions.map((item) => (
            <li key={item.id} className="rounded-card border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex-1 font-bold">{item.formName}</p>
                <time dateTime={item.createdAt} className="text-step--1 text-subtle">
                  {new Date(item.createdAt).toLocaleString()}
                </time>
                <span
                  className={cn(
                    'rounded-pill px-2.5 py-1 text-[0.68rem] font-extrabold uppercase',
                    item.emailed ? 'bg-success/15 text-[color:var(--color-success)]' : 'bg-danger/10 text-danger',
                  )}
                >
                  {item.emailed ? 'Emailed' : 'Not emailed'}
                </span>
              </div>
              {item.emailError ? <p className="mt-2 text-step--1 text-danger">{item.emailError}</p> : null}
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-step--1 sm:grid-cols-2">
                {Object.entries(item.data).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <dt className="font-bold">{key}:</dt>
                    <dd className="text-muted">{value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
