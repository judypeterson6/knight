'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn, formatDate } from '@/lib/utils'
import { Badge } from '@/components/admin/ui'

export interface PostRow {
  id: string
  slug: string
  title: string
  status: string
  /** Real visibility, which `status` alone does not convey for SCHEDULED rows. */
  state: 'Live' | 'Scheduled' | 'Draft' | 'Archived'
  author: string
  category: string
  publishedAt: string | null
}

/** Posts list with selection and bulk actions. */
export function PostsTable({
  posts,
  categories,
  canDelete,
}: {
  posts: PostRow[]
  categories: { id: string; name: string }[]
  canDelete: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [action, setAction] = useState('publish')
  const [categoryId, setCategoryId] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const allSelected = posts.length > 0 && selected.length === posts.length

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  async function apply() {
    if (!selected.length) return
    if (action === 'delete' && !window.confirm(`Delete ${selected.length} post(s)? This cannot be undone.`)) return

    setBusy(true)
    setMessage('Applying…')

    const res = await fetch('/api/admin/posts/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ids: selected,
        action,
        ...(action === 'setCategory' ? { categoryId: categoryId || null } : {}),
      }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string; data?: { affected: number; skipped: number } }

    setBusy(false)
    if (!body.ok) {
      setMessage(body.error ?? 'Bulk action failed.')
      return
    }

    const { affected = 0, skipped = 0 } = body.data ?? {}
    setMessage(`${affected} post(s) updated${skipped ? `, ${skipped} skipped (not yours)` : ''}.`)
    setSelected([])
    router.refresh()
  }

  return (
    <>
      <div
        className={cn(
          'mb-4 flex flex-wrap items-end gap-3 rounded-card border p-4 transition',
          selected.length ? 'border-primary bg-primary-soft/30' : 'border-line bg-surface',
        )}
      >
        <p className="text-step--1 font-bold">
          {selected.length ? `${selected.length} selected` : 'Select posts to act on them'}
        </p>

        <div>
          <label htmlFor="bulk-action" className="sr-only">
            Bulk action
          </label>
          <select
            id="bulk-action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            disabled={!selected.length}
            className="kc-field !py-2"
          >
            <option value="publish">Publish</option>
            <option value="draft">Move to draft</option>
            <option value="archive">Archive</option>
            <option value="setCategory">Set category</option>
            {canDelete ? <option value="delete">Delete</option> : null}
          </select>
        </div>

        {action === 'setCategory' ? (
          <div>
            <label htmlFor="bulk-category" className="sr-only">
              Category
            </label>
            <select
              id="bulk-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="kc-field !py-2"
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void apply()}
          disabled={!selected.length || busy}
          className="kc-btn kc-btn-primary !px-5 !py-2.5 disabled:opacity-50"
        >
          {busy ? 'Applying…' : 'Apply'}
        </button>

        <p role="status" aria-live="polite" className={message ? 'text-step--1 text-muted' : 'sr-only'}>
          {message}
        </p>
      </div>

      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[48rem] border-collapse text-step--1">
          <thead>
            <tr className="bg-surface-alt text-left">
              <th scope="col" className="border-b border-line px-4 py-3">
                <input
                  id="select-all-posts"
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => setSelected(e.target.checked ? posts.map((p) => p.id) : [])}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                <label htmlFor="select-all-posts" className="sr-only">
                  Select all posts
                </label>
              </th>
              {['Title', 'Category', 'Author', 'Status', 'Published', ''].map((h) => (
                <th key={h} scope="col" className="border-b border-line px-4 py-3 font-bold">
                  {h || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr
                key={post.id}
                className={cn(
                  'border-b border-line last:border-0 hover:bg-surface-alt',
                  selected.includes(post.id) && 'bg-primary-soft/20',
                )}
              >
                <td className="px-4 py-3">
                  <input
                    id={`select-${post.id}`}
                    type="checkbox"
                    checked={selected.includes(post.id)}
                    onChange={() => toggle(post.id)}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  <label htmlFor={`select-${post.id}`} className="sr-only">
                    Select {post.title}
                  </label>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/posts/${post.id}`} className="font-bold text-primary hover:underline">
                    {post.title}
                  </Link>
                  <span className="block font-mono text-[0.7rem] text-subtle">/blog/{post.slug}</span>
                </td>
                <td className="px-4 py-3 text-muted">{post.category || '—'}</td>
                <td className="px-4 py-3 text-muted">{post.author || '—'}</td>
                <td className="px-4 py-3">
                  <Badge tone={post.state === 'Live' ? 'PUBLISHED' : post.state === 'Scheduled' ? 'SCHEDULED' : 'DRAFT'}>
                    {post.state}
                  </Badge>
                  {post.state === 'Scheduled' && post.publishedAt ? (
                    <span className="mt-1 block text-[0.68rem] text-subtle">
                      goes live {formatDate(post.publishedAt)}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted">
                  {post.publishedAt ? formatDate(post.publishedAt) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <Link href={`/admin/posts/${post.id}`} className="font-bold text-primary hover:underline">
                      Edit
                    </Link>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="font-bold text-muted hover:text-primary hover:underline"
                    >
                      View
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
