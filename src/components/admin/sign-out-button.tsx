'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: '/' })}
      className="rounded-control border border-line px-3.5 py-2 text-step--1 font-bold transition hover:border-primary hover:text-primary"
    >
      Sign out
    </button>
  )
}
