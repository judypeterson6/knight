'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface NavLink {
  id: string
  label: string
  url: string
  rel: string | null
  target: string | null
}

/**
 * Primary nav.
 *
 * The items themselves are read from the database on the server and passed in;
 * only the active-state comparison happens on the client. That is deliberate:
 * resolving the current path server-side would mean calling `headers()` in the
 * layout, which opts every public page out of the full-route cache. This way
 * the pages stay statically cacheable and the active state also stays correct
 * across client-side navigations.
 */
export function NavLinks({ items }: { items: NavLink[] }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Primary" className="hidden items-center gap-6 xl:flex xl:gap-8">
      {items.map((item) => {
        const active = pathname === item.url || (item.url !== '/' && pathname.startsWith(`${item.url}/`))
        return (
          <Link
            key={item.id}
            href={item.url}
            aria-current={active ? 'page' : undefined}
            rel={item.rel ?? undefined}
            target={item.target ?? undefined}
            className={
              active
                ? 'text-[0.94rem] font-bold text-primary'
                : 'text-[0.94rem] font-semibold text-ink transition hover:text-primary'
            }
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
