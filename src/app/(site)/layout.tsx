import { headers } from 'next/headers'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { EditToolbarGate } from '@/components/admin/edit-toolbar-gate'

/**
 * Public site shell.
 *
 * Landmark order is <header> / <main> / <footer>. Nothing renders above the
 * page's <h1> inside <main> — no cookie bar, ad slot, share row, email capture
 * or marketing banner is permitted there.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers()
  const currentPath = headerList.get('x-pathname') ?? '/'

  return (
    <>
      <a href="#main" className="kc-skip-link">
        Skip to main content
      </a>
      <SiteHeader currentPath={currentPath} />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
      {/* Renders only for authenticated admins/editors; its JS is never sent to anonymous visitors. */}
      <EditToolbarGate path={currentPath} />
    </>
  )
}
