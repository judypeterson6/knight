import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetPasswordForm } from '@/components/admin/reset-password-form'

export const metadata: Metadata = {
  title: 'Reset password — Knights Coaches admin',
  robots: { index: false, follow: false },
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-block border border-line bg-surface p-8 shadow-card">
        <h1 className="text-step-3">{token ? 'Choose a new password' : 'Reset your password'}</h1>
        <p className="mt-2 text-step--1 text-muted">
          {token
            ? 'Pick something at least 10 characters long.'
            : 'Enter your email address and we will send you a reset link.'}
        </p>

        <ResetPasswordForm token={token ?? null} />

        <p className="mt-6 text-step--1">
          <Link href="/admin/login" className="font-bold text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
