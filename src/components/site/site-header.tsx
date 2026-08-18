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
  const ctaItems = items.filter((item) => item.isCta)
  const logo = branding.headerLogo

  return (
    <header className="absolute inset-x-0 top-0 z-50 px-4 py-5 md:px-8 xl:px-5 2xl:px-8">
      <div className="mx-auto flex max-w-container-wide flex-nowrap items-stretch justify-between gap-3 rounded-[14px] bg-surface p-4 pl-5 shadow-raised md:pl-6">
        {/* mr-auto pins the mark to the left edge and pushes the nav and the
            actions right, rather than letting justify-between spread all three
            evenly. */}
        <Link href="/" className="mr-auto flex flex-shrink-0 items-center" aria-label={`${organization.name} — home`}>
          <Image
            src={logo.src}
            alt={logo.alt}
            width={logo.width}
            height={logo.height}
            priority
            className="h-[58px] w-auto md:h-[76px]"
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

        {/* Header actions come from the menu's isCta items, so their labels and
            destinations are editable from /admin like every other link. The
            first reads as the primary action, the rest as outlines. Hidden
            below lg, where the mobile menu carries them instead of crowding
            the bar. */}
        {ctaItems.length ? (
          <div className="ml-3 hidden items-center gap-2 lg:flex">
            {ctaItems.map((item, i) => (
              <Link
                key={item.id}
                href={item.url}
                rel={item.rel ?? undefined}
                target={item.target ?? undefined}
                className={
                  i === 0
                    ? 'whitespace-nowrap rounded-[12px] bg-surface-dark px-4 py-3 text-[0.85rem] font-extrabold text-on-dark transition hover:bg-ink 2xl:px-5'
                    : 'whitespace-nowrap rounded-[12px] border-2 border-line px-4 py-[0.65rem] text-[0.85rem] font-extrabold text-ink transition hover:border-primary hover:text-primary-deep 2xl:px-5'
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}

        {/* The label text is hidden below the sm breakpoint, which left the
            link with nothing but an icon and no accessible name. An explicit
            aria-label names it at every viewport. */}
        <a
          href={telHref(organization.phone)}
          aria-label={`Call ${organization.name} on ${formatPhone(organization.phone)}`}
          className="-my-1.5 -mr-1.5 ml-2 flex flex-shrink-0 items-center gap-3 rounded-[12px] bg-primary px-4 text-primary-contrast transition hover:bg-primary-hover md:px-5"
        >
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white/20">
            <Icon name="phone" className="h-4.5 w-4.5" />
          </span>
          <span className="hidden whitespace-nowrap leading-tight sm:block">
            <span className="block text-[0.94rem] font-extrabold xl:hidden">Contact Us Now</span>
            <span className="block text-[0.84rem] font-semibold opacity-95">{formatPhone(organization.phone)}</span>
          </span>
        </a>

        <MobileNav
          items={navItems.map((item) => ({ id: item.id, label: item.label, url: item.url }))}
          ctaItems={ctaItems.map((item) => ({ id: item.id, label: item.label, url: item.url }))}
          phoneHref={telHref(organization.phone)}
          phoneLabel={formatPhone(organization.phone)}
          logo={logo}
        />
      </div>
    </header>
  )
}
