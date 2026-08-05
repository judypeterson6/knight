import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { EditToolbarGate } from '@/components/admin/edit-toolbar-gate'

/**
 * Public site shell.
 *
 * Landmark order is <header> / <main> / <footer>. Nothing renders above the
 * page's <h1> inside <main> — no cookie bar, ad slot, share row, email capture
 * or marketing banner is permitted there.
 *
 * Deliberately calls no dynamic request API (`headers()` / `cookies()`) of its
 * own: the nav's active state is resolved client-side from `usePathname()`, so
 * the layout stays statically renderable and the public pages keep their
 * full-route cache. See EditToolbarGate for how the editor toolbar is gated
 * without dragging the whole site into dynamic rendering.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="kc-skip-link">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
      <EditToolbarGate />
    </>
  )
}
