'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/admin/ui'
import { Text } from '@/components/admin/props-inspector'

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  bio: string
  lastLoginAt: string | null
}

const ROLES = ['ADMIN', 'EDITOR', 'AUTHOR']

export function UsersManager({
  users,
  currentUserId,
  activeAdmins,
}: {
  users: UserRow[]
  currentUserId: string
  activeAdmins: number
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
  const [generated, setGenerated] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function create(form: { name: string; email: string; role: string; password: string; bio: string }) {
    setBusy(true)
    setMessage('Creating…')
    setGenerated(null)

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        role: form.role,
        bio: form.bio || null,
        active: true,
        ...(form.password ? { password: form.password } : {}),
      }),
    })
    const body = (await res.json()) as {
      ok: boolean
      error?: string
      data?: { generatedPassword: string | null; invitationSent: boolean; mailError: string | null }
    }

    setBusy(false)
    if (!body.ok) {
      setMessage(body.error ?? 'Create failed.')
      return
    }

    setCreating(false)
    setGenerated(body.data?.generatedPassword ?? null)
    setMessage(
      body.data?.invitationSent
        ? 'User created and the invitation email was sent.'
        : `User created. The invitation email could not be sent${body.data?.mailError ? ` (${body.data.mailError})` : ''} — give them the password below.`,
    )
    router.refresh()
  }

  async function update(user: UserRow, patch: Record<string, unknown>) {
    setBusy(true)
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }
    setBusy(false)
    setMessage(body.ok ? 'Saved.' : (body.error ?? 'Save failed.'))
    if (body.ok) {
      setEditing(null)
      router.refresh()
    }
  }

  async function remove(user: UserRow) {
    if (!window.confirm(`Delete ${user.name}? Their posts stay published but lose the author link.`)) return
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    const body = (await res.json()) as { ok: boolean; error?: string }
    setMessage(body.ok ? 'User deleted.' : (body.error ?? 'Delete failed.'))
    if (body.ok) router.refresh()
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => setCreating(!creating)} className="kc-btn kc-btn-primary !px-5 !py-2.5">
          {creating ? 'Cancel' : 'Invite a user'}
        </button>
        <p role="status" aria-live="polite" className={message ? 'text-step--1 text-muted' : 'sr-only'}>
          {message}
        </p>
      </div>

      {generated ? (
        <p className="mb-6 rounded-card border border-primary bg-primary-soft p-4 text-step--1">
          One-time password (shown once):{' '}
          <code className="font-mono font-bold">{generated}</code>
        </p>
      ) : null}

      {creating ? <CreateForm onSubmit={create} busy={busy} /> : null}
      {editing ? <EditForm user={editing} onSubmit={update} onCancel={() => setEditing(null)} busy={busy} /> : null}

      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[44rem] border-collapse text-step--1">
          <thead>
            <tr className="bg-surface-alt text-left">
              {['Name', 'Email', 'Role', 'Active', 'Last sign-in', ''].map((h) => (
                <th key={h} scope="col" className="border-b border-line px-4 py-3 font-bold">
                  {h || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isLastAdmin = user.role === 'ADMIN' && user.active && activeAdmins === 1
              return (
                <tr key={user.id} className="border-b border-line last:border-0 hover:bg-surface-alt">
                  <td className="px-4 py-3 font-bold">
                    {user.name}
                    {user.id === currentUserId ? <span className="ml-2 text-subtle">(you)</span> : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge tone={user.role}>{user.role}</Badge>
                  </td>
                  <td className="px-4 py-3">{user.active ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-muted">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={() => setEditing(user)} className="font-bold text-primary hover:underline">
                        Edit
                      </button>
                      {isLastAdmin ? (
                        <span className="text-subtle" title="The last active admin cannot be removed or demoted.">
                          Protected
                        </span>
                      ) : user.id === currentUserId ? (
                        <span className="text-subtle">—</span>
                      ) : (
                        <button type="button" onClick={() => void remove(user)} className="font-bold text-danger hover:underline">
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function CreateForm({
  onSubmit,
  busy,
}: {
  onSubmit: (form: { name: string; email: string; role: string; password: string; bio: string }) => void
  busy: boolean
}) {
  const [form, setForm] = useState({ name: '', email: '', role: 'AUTHOR', password: '', bio: '' })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(form)
      }}
      className="mb-8 space-y-4 rounded-card border border-primary bg-surface p-6"
    >
      <h2 className="text-step-1">Invite a user</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Text label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <div>
          <label htmlFor="new-role" className="kc-label">
            Role
          </label>
          <select id="new-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="kc-field">
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
        <Text
          label="Password (optional)"
          value={form.password}
          onChange={(v) => setForm({ ...form, password: v })}
          help="Leave blank to generate one and email an invitation."
        />
        <div className="sm:col-span-2">
          <Text label="Bio" value={form.bio} multiline onChange={(v) => setForm({ ...form, bio: v })} />
        </div>
      </div>
      <button type="submit" disabled={busy} className="kc-btn kc-btn-primary !px-5 !py-2.5">
        {busy ? 'Creating…' : 'Create user'}
      </button>
    </form>
  )
}

function EditForm({
  user,
  onSubmit,
  onCancel,
  busy,
}: {
  user: UserRow
  onSubmit: (user: UserRow, patch: Record<string, unknown>) => void
  onCancel: () => void
  busy: boolean
}) {
  const [form, setForm] = useState({ ...user, password: '' })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(user, {
          name: form.name,
          email: form.email,
          role: form.role,
          active: form.active,
          bio: form.bio || null,
          ...(form.password ? { password: form.password } : {}),
        })
      }}
      className="mb-8 space-y-4 rounded-card border border-primary bg-surface p-6"
    >
      <h2 className="text-step-1">Edit {user.name}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Text label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <div>
          <label htmlFor="edit-role" className="kc-label">
            Role
          </label>
          <select id="edit-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="kc-field">
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
        <Text label="Reset password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} help="Leave blank to keep the current one. Minimum 10 characters." />
        <label className="flex items-center gap-3 text-step--1 font-semibold">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-[18px] w-[18px] accent-[var(--color-primary)]" />
          Active
        </label>
        <div className="sm:col-span-2">
          <Text label="Bio" value={form.bio} multiline onChange={(v) => setForm({ ...form, bio: v })} />
        </div>
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
