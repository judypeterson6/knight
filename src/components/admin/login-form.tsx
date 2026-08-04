'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

export function LoginForm({ callbackUrl, initialError }: { callbackUrl: string; initialError: string | null }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(initialError)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const data = new FormData(event.currentTarget)
    const result = await signIn('credentials', {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
      redirect: false,
    })

    if (!result || result.error) {
      setError('Wrong email or password, or the account is inactive.')
      setBusy(false)
      return
    }
    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="kc-label">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="kc-field" />
      </div>
      <div>
        <label htmlFor="password" className="kc-label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="kc-field"
        />
      </div>

      <p role="alert" aria-live="assertive" className={error ? 'text-step--1 text-danger' : 'sr-only'}>
        {error}
      </p>

      <button type="submit" disabled={busy} className="kc-btn kc-btn-primary w-full disabled:opacity-60">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
