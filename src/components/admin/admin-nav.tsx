import Link from 'next/link'
import type { Role } from '@prisma/client'
import { cn } from '@/lib/utils'

interface NavEntry {
  label: string
  href: string
  minRole: Role
}

interface NavGroup {
  heading: string
  items: NavEntry[]
}

const GROUPS: NavGroup[] = [
  {
    heading: 'Overview',
    items: [{ label: 'Dashboard', href: '/admin', minRole: 'AUTHOR' }],
  },
  {
    heading: 'Content',
    items: [
      { label: 'Pages', href: '/admin/pages', minRole: 'EDITOR' },
      { label: 'Posts', href: '/admin/posts', minRole: 'AUTHOR' },
      { label: 'Categories', href: '/admin/categories', minRole: 'EDITOR' },
      { label: 'Fleet', href: '/admin/fleet', minRole: 'EDITOR' },
      { label: 'Locations', href: '/admin/locations', minRole: 'EDITOR' },
      { label: 'Testimonials', href: '/admin/testimonials', minRole: 'EDITOR' },
      { label: 'FAQs', href: '/admin/faqs', minRole: 'EDITOR' },
      { label: 'Media', href: '/admin/media', minRole: 'AUTHOR' },
    ],
  },
  {
    heading: 'Enquiries',
    items: [
      { label: 'Inbox', href: '/admin/inbox', minRole: 'EDITOR' },
      { label: 'Forms', href: '/admin/forms', minRole: 'ADMIN' },
    ],
  },
  {
    heading: 'Search',
    items: [
      { label: 'SEO settings', href: '/admin/seo', minRole: 'ADMIN' },
      { label: 'SEO audit', href: '/admin/seo/audit', minRole: 'EDITOR' },
      { label: 'Redirects', href: '/admin/seo/redirects', minRole: 'ADMIN' },
      { label: 'Indexing', href: '/admin/seo/indexing', minRole: 'ADMIN' },
    ],
  },
  {
    heading: 'Appearance',
    items: [
      { label: 'Theme', href: '/admin/appearance', minRole: 'ADMIN' },
      { label: 'Menus', href: '/admin/menus', minRole: 'ADMIN' },
    ],
  },
  {
    heading: 'System',
    items: [
      { label: 'Mail (SMTP)', href: '/admin/mail', minRole: 'ADMIN' },
      { label: 'Users', href: '/admin/users', minRole: 'ADMIN' },
      { label: 'My profile', href: '/admin/profile', minRole: 'AUTHOR' },
    ],
  },
]

const RANK: Record<Role, number> = { AUTHOR: 1, EDITOR: 2, ADMIN: 3 }

export function AdminNav({
  role,
  pathname,
  horizontal = false,
}: {
  role: Role
  pathname: string
  horizontal?: boolean
}) {
  const visible = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => RANK[role] >= RANK[item.minRole]),
  })).filter((group) => group.items.length > 0)

  if (horizontal) {
    return (
      <nav aria-label="Admin sections" className="overflow-x-auto border-b border-line bg-surface px-4 py-3">
        <ul className="flex gap-2">
          {visible.flatMap((group) =>
            group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  className={cn(
                    'whitespace-nowrap rounded-pill px-3.5 py-2 text-step--1 font-bold',
                    pathname === item.href ? 'bg-primary text-primary-contrast' : 'bg-surface-alt text-muted',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            )),
          )}
        </ul>
      </nav>
    )
  }

  return (
    <nav aria-label="Admin sections" className="p-4">
      {visible.map((group) => (
        <div key={group.heading} className="mb-6">
          <h2 className="mb-2 px-3 text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-subtle">
            {group.heading}
          </h2>
          <ul>
            {group.items.map((item) => {
              const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`))
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block rounded-control px-3 py-2 text-step--1 font-semibold transition',
                      active ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-alt hover:text-ink',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
