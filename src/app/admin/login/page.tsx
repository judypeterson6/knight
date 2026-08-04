import type { Metadata } from 'next'
import { LoginForm } from '@/components/admin/login-form'

export const metadata: Metadata = {
  title: 'Sign in — Knights Coaches admin',
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  const { callbackUrl, error } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-block border border-line bg-surface p-8 shadow-card">
        <h1 className="text-step-3">Sign in</h1>
        <p className="mt-2 text-step--1 text-muted">Knights Coaches site administration.</p>
        <LoginForm callbackUrl={callbackUrl ?? '/admin'} initialError={error ? 'Wrong email or password.' : null} />
      </div>
    </main>
  )
}
