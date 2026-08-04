import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { currentUser } from '@/lib/auth'
import { AdminNav } from '@/components/admin/admin-nav'
import { SignOutButton } from '@/components/admin/sign-out-button'

export const metadata: Metadata = {
  title: 'Admin — Knights Coaches',
  robots: { index: false, follow: false },
}

/**
 * Admin shell.
 *
 * The middleware blocks /admin without a session cookie; this layout resolves
 * the actual user, and every mutation re-checks the role server-side in the API
 * route. Three checks, because the UI one is not a security control.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  const pathname = (await headers()).get('x-pathname') ?? '/admin'

  // /admin/login renders bare — it is the one admin route without a session.
  if (pathname === '/admin/login' || !user) {
    return <div className="min-h-screen bg-surface-alt">{children}</div>
  }

  return (
    <div className="min-h-screen bg-surface-alt">
      <a href="#admin-main" className="kc-skip-link">
        Skip to admin content
      </a>

      <div className="mx-auto flex max-w-[100rem] gap-0">
        <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 overflow-y-auto border-r border-line bg-surface lg:block">
          <div className="border-b border-line p-5">
            <Link href="/admin" className="text-step-1 font-extrabold">
              Knights Coaches
            </Link>
            <p className="mt-1 text-step--1 text-muted">Site administration</p>
          </div>
          <AdminNav role={user.role} pathname={pathname} />
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-line bg-surface px-6 py-4">
            <div className="lg:hidden">
              <Link href="/admin" className="font-extrabold">
                Knights Coaches
              </Link>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <Link href="/" className="text-step--1 font-bold text-primary hover:underline">
                View site →
              </Link>
              <p className="hidden text-step--1 text-muted sm:block">
                {user.name} · <span className="font-bold text-ink">{user.role}</span>
              </p>
              <SignOutButton />
            </div>
          </header>

          <div className="lg:hidden">
            <AdminNav role={user.role} pathname={pathname} horizontal />
          </div>

          <main id="admin-main" tabIndex={-1} className="p-6 lg:p-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
