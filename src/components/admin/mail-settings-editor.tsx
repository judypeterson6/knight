'use client'

import { useState } from 'react'
import { Field } from '@/components/admin/block-builder'
import type { MailSettings } from '@/lib/settings-defaults'

/**
 * SMTP settings.
 *
 * The stored password is never sent to the browser: the server returns an
 * empty string plus `hasPassword`. Leaving the field blank keeps whatever is
 * already saved, so changing the port does not wipe the credentials.
 */
export function MailSettingsEditor({
  initial,
  hasPassword,
  envHost,
}: {
  initial: MailSettings
  hasPassword: boolean
  envHost: string
}) {
  const [form, setForm] = useState({ ...initial, password: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [testTo, setTestTo] = useState('')
  const [testing, setTesting] = useState(false)

  async function save() {
    setBusy(true)
    setMessage('Saving…')
    const res = await fetch('/api/admin/settings/mail', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: { ...form, port: Number(form.port) } }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }
    setBusy(false)
    setMessage(body.ok ? 'Saved. New mail goes through these settings immediately.' : (body.error ?? 'Save failed.'))
    if (body.ok) setForm((prev) => ({ ...prev, password: '' }))
  }

  async function sendTest() {
    setTesting(true)
    setMessage('Sending test message…')
    const res = await fetch('/api/admin/mail/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to: testTo }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string; data?: { host: string; source: string } }
    setTesting(false)
    setMessage(
      body.ok
        ? `Sent to ${testTo} via ${body.data?.host} (${body.data?.source}). Check the inbox, and the spam folder.`
        : (body.error ?? 'Send failed.'),
    )
  }

  const usingEnv = !form.host && Boolean(envHost)
  // Mirrors recipientList() on the server so the count shown here matches what
  // actually gets mailed.
  const recipientCount = form.notifyTo.split(/[,;]/).filter((a) => a.includes('@')).length

  return (
    <div className="space-y-5">
      <section className="space-y-5 rounded-card border border-line bg-surface p-6">
        <h2 className="text-step-1 font-extrabold">SMTP server</h2>

        {usingEnv ? (
          <p className="rounded-control border border-line bg-surface-alt p-4 text-step--1 text-muted">
            No host is set here, so mail is using <code>SMTP_HOST={envHost}</code> from the environment. Filling in a
            host below takes over from it.
          </p>
        ) : null}

        <Field
          label="Host"
          value={form.host}
          onChange={(v) => setForm({ ...form, host: v })}
          help="e.g. smtp.hostinger.com. Leave blank to fall back to the SMTP_* environment variables."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Port"
            type="number"
            value={String(form.port)}
            onChange={(v) => setForm({ ...form, port: Number(v) || 0 })}
            help="587 for STARTTLS, 465 for implicit TLS."
          />
          <div className="flex items-end">
            <label className="flex items-center gap-3 pb-3 text-step--1 font-semibold">
              <input
                type="checkbox"
                checked={form.secure}
                onChange={(e) => setForm({ ...form, secure: e.target.checked })}
                className="h-[18px] w-[18px] accent-[var(--color-primary)]"
              />
              Implicit TLS (tick for port 465)
            </label>
          </div>
        </div>

        <Field label="Username" value={form.user} onChange={(v) => setForm({ ...form, user: v })} help="Usually the full mailbox address. Leave blank for an unauthenticated relay." />
        <Field
          label="Password"
          type="password"
          value={form.password}
          onChange={(v) => setForm({ ...form, password: v })}
          help={
            hasPassword
              ? 'A password is saved. Leave blank to keep it, or type a new one to replace it.'
              : 'No password saved yet.'
          }
        />
      </section>

      <section className="space-y-5 rounded-card border border-line bg-surface p-6">
        <h2 className="text-step-1 font-extrabold">Addresses</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From name" value={form.fromName} onChange={(v) => setForm({ ...form, fromName: v })} />
          <Field
            label="From address"
            type="email"
            value={form.fromEmail}
            onChange={(v) => setForm({ ...form, fromEmail: v })}
            help="Must be a mailbox the SMTP server is allowed to send as."
          />
        </div>
        <Field
          label="Send form submissions to"
          value={form.notifyTo}
          onChange={(v) => setForm({ ...form, notifyTo: v })}
          help={
            recipientCount > 1
              ? `${recipientCount} recipients. Every one receives a copy of each submission.`
              : 'One address, or several separated by commas. Blank uses the organisation email.'
          }
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={busy} className="kc-btn kc-btn-primary disabled:opacity-50">
          {busy ? 'Saving…' : 'Save mail settings'}
        </button>
        <p role="status" aria-live="polite" className="text-step--1 text-muted">
          {message}
        </p>
      </div>

      <section className="space-y-4 rounded-card border border-line bg-surface-alt p-6">
        <h2 className="text-step-1 font-extrabold">Send a test</h2>
        <p className="text-step--1 text-muted">
          Sends one real message using the settings currently saved. Save first if you have just changed something.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[18rem] flex-1">
            <Field label="Send to" type="email" value={testTo} onChange={setTestTo} />
          </div>
          <button
            type="button"
            onClick={() => void sendTest()}
            disabled={testing || !testTo.includes('@')}
            className="kc-btn kc-btn-outline mb-1 disabled:opacity-50"
          >
            {testing ? 'Sending…' : 'Send test email'}
          </button>
        </div>
      </section>

      <p className="text-step--1 text-subtle">
        A submission is written to the database before mail is attempted, so a delivery failure never loses a lead — it
        is recorded on the submission and shown in the inbox instead.
      </p>
    </div>
  )
}
