'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Two states in one form: request a link (no token in the URL), or set a new
 * password (token present). The request step always reports the same result
 * whether or not the address exists, so it cannot be used to enumerate accounts.
 */
export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const email = String(new FormData(event.currentTarget).get('email') ?? '')
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const body = (await res.json()) as { ok: boolean; data?: { message: string } }

    setBusy(false)
    setDone(true)
    setMessage(body.data?.message ?? 'If that address has an account, a reset link is on its way.')
  }

  async function setPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') ?? '')
    const confirm = String(data.get('confirm') ?? '')

    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }

    setBusy(true)
    setError(null)

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }

    setBusy(false)
    if (!body.ok) {
      setError(body.error ?? 'Could not reset the password.')
      return
    }
    setDone(true)
    setMessage('Password updated. Redirecting you to sign in…')
    setTimeout(() => router.push('/admin/login'), 1500)
  }

  if (done && !error) {
    return (
      <p role="status" aria-live="polite" className="mt-8 rounded-control border border-line bg-surface-alt p-4 text-step--1">
        {message}
      </p>
    )
  }

  return (
    <form onSubmit={token ? setPassword : requestLink} className="mt-8 space-y-5">
      {token ? (
        <>
          <div>
            <label htmlFor="password" className="kc-label">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              className="kc-field"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="kc-label">
              Confirm new password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              className="kc-field"
            />
          </div>
        </>
      ) : (
        <div>
          <label htmlFor="email" className="kc-label">
            Email
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className="kc-field" />
        </div>
      )}

      <p role="alert" aria-live="assertive" className={error ? 'text-step--1 text-danger' : 'sr-only'}>
        {error}
      </p>

      <button type="submit" disabled={busy} className="kc-btn kc-btn-primary w-full disabled:opacity-60">
        {busy ? 'Working…' : token ? 'Set new password' : 'Send reset link'}
      </button>
    </form>
  )
}
