'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Text } from '@/components/admin/props-inspector'

export function ProfileEditor({ initial }: { initial: { name: string; bio: string } }) {
  const router = useRouter()
  const [form, setForm] = useState({ ...initial, currentPassword: '', newPassword: '', confirmPassword: '' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setMessage('The new passwords do not match.')
      return
    }

    setBusy(true)
    setMessage('Saving…')

    const res = await fetch('/api/admin/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        bio: form.bio || null,
        ...(form.newPassword ? { currentPassword: form.currentPassword, newPassword: form.newPassword } : {}),
      }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }

    setBusy(false)
    if (!body.ok) {
      setMessage(body.error ?? 'Save failed.')
      return
    }
    setMessage('Profile saved.')
    setForm({ ...form, currentPassword: '', newPassword: '', confirmPassword: '' })
    router.refresh()
  }

  return (
    <section className="max-w-2xl space-y-5 rounded-card border border-line bg-surface p-6">
      <Text label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
      <Text
        label="Bio"
        value={form.bio}
        multiline
        onChange={(v) => setForm({ ...form, bio: v })}
        help="Shown in the author box under your published posts."
      />

      <fieldset className="rounded-control border border-line p-4">
        <legend className="px-1 font-bold">Change password</legend>
        <div className="space-y-4">
          <div>
            <label htmlFor="current-password" className="kc-label">
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              className="kc-field"
            />
          </div>
          <div>
            <label htmlFor="new-password" className="kc-label">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              className="kc-field"
            />
            <p className="mt-1.5 text-step--1 text-subtle">Minimum 10 characters.</p>
          </div>
          <div>
            <label htmlFor="confirm-password" className="kc-label">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className="kc-field"
            />
          </div>
        </div>
      </fieldset>

      <p role="status" aria-live="polite" className={message ? 'text-step--1 text-muted' : 'sr-only'}>
        {message}
      </p>

      <button type="button" onClick={() => void save()} disabled={busy} className="kc-btn kc-btn-primary !px-5 !py-2.5">
        {busy ? 'Saving…' : 'Save profile'}
      </button>
    </section>
  )
}
