import Image from 'next/image'
import Link from 'next/link'
import { getMenu } from '@/lib/menus'
import { getSettings } from '@/lib/settings'
import { formatPhone, telHref } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { MobileNav } from '@/components/site/mobile-nav'
import { NavLinks } from '@/components/site/nav-links'

/**
 * Site header. Rendered server-side from the HEADER menu in the database.
 *
 * The phone number is real <a href="tel:"> text — in the header, the footer and
 * on the contact page — rather than an image or a JS-built string.
 */
export async function SiteHeader() {
  const [items, { branding, organization }] = await Promise.all([getMenu('HEADER'), getSettings()])

  const navItems = items.filter((item) => !item.isCta)
  const logo = branding.headerLogo

  return (
    <header className="absolute inset-x-0 top-0 z-50 px-4 py-5 md:px-8">
      <div className="mx-auto flex max-w-container-wide items-stretch justify-between gap-4 rounded-[14px] bg-surface p-4 pl-6 shadow-raised">
        <Link href="/" className="flex items-center" aria-label={`${organization.name} — home`}>
          <Image
            src={logo.src}
            alt={logo.alt}
            width={logo.width}
            height={logo.height}
            priority
            className="h-[52px] w-auto md:h-[62px]"
          />
        </Link>

        <NavLinks
          items={navItems.map((item) => ({
            id: item.id,
            label: item.label,
            url: item.url,
            rel: item.rel,
            target: item.target,
          }))}
        />

        {/* The label text is hidden below the sm breakpoint, which left the
            link with nothing but an icon and no accessible name. An explicit
            aria-label names it at every viewport. */}
        <a
          href={telHref(organization.phone)}
          aria-label={`Call ${organization.name} on ${formatPhone(organization.phone)}`}
          className="-my-1.5 -mr-1.5 ml-4 flex items-center gap-3.5 rounded-[12px] bg-primary px-5 text-primary-contrast transition hover:bg-primary-hover md:px-6"
        >
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white/20">
            <Icon name="phone" className="h-4.5 w-4.5" />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[0.94rem] font-extrabold">Contact Us Now</span>
            <span className="block text-[0.84rem] font-semibold opacity-95">{formatPhone(organization.phone)}</span>
          </span>
        </a>

        <MobileNav
          items={navItems.map((item) => ({ id: item.id, label: item.label, url: item.url }))}
          phoneHref={telHref(organization.phone)}
          phoneLabel={formatPhone(organization.phone)}
          logo={logo}
        />
      </div>
    </header>
  )
}
