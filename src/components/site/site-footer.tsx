import Image from 'next/image'
import { getMenu, type MenuNode } from '@/lib/menus'
import { getSettings } from '@/lib/settings'
import { formatPhone, telHref } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { SmartLink } from '@/components/ui/primitives'

/**
 * Site footer, rendered server-side from the FOOTER menu.
 *
 * The live WordPress footer linked to two different leasing URLs and two
 * different nationwide URLs. The seeded menu points at one canonical route per
 * topic; the duplicates are 301s in the Redirect table.
 */
export async function SiteFooter() {
  const [items, { branding, organization }] = await Promise.all([getMenu('FOOTER'), getSettings()])

  const columns = new Map<number, MenuNode[]>()
  for (const item of items) {
    const key = item.column ?? 1
    columns.set(key, [...(columns.get(key) ?? []), item])
  }
  const columnKeys = [...columns.keys()].sort((a, b) => a - b)
  const logo = branding.footerLogo
  const socials = organization.sameAs.filter((s) => s.url)
  const year = new Date().getFullYear()

  return (
    <footer className="relative overflow-hidden bg-[#0a0806] text-on-dark">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_460px_at_82%_-10%,var(--color-primary-soft),transparent_60%)]"
      />

      <div className="kc-container relative pt-16 md:pt-20">
        <div className="grid gap-10 border-b border-white/10 pb-12 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.3fr]">
          <div>
            <Image
              src={logo.src}
              alt={logo.alt}
              width={logo.width}
              height={logo.height}
              className="mb-6 h-20 w-auto"
            />
            <p className="max-w-sm text-step--1 leading-[1.8] text-on-dark-muted">{organization.description}</p>
            {socials.length ? (
              <ul className="mt-6 flex gap-3">
                {socials.map((social) => (
                  <li key={social.label}>
                    <SmartLink
                      href={social.url}
                      aria-label={social.label}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-on-dark-muted transition hover:border-transparent hover:bg-primary hover:text-primary-contrast"
                    >
                      <Icon name={social.icon} className="h-4 w-4" />
                    </SmartLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {columnKeys.map((key) => {
            const column = columns.get(key) ?? []
            const [first, ...rest] = column
            // The first item in a footer column is its heading, either because
            // the links hang off it as children or because it carries no real
            // destination of its own. Without the second test a heading row
            // stored flat (url "#") rendered as a link that goes nowhere, and
            // the column fell back to a generated "Links 1" title.
            const isLabelOnly = Boolean(first) && (!first.url || first.url === '#')
            const heading = first?.children.length || isLabelOnly ? first : null
            const links = heading ? (heading.children.length ? heading.children : rest) : column
            const headingId = `footer-col-${key}`
            return (
              <nav key={key} aria-labelledby={headingId}>
                <h2 id={headingId} className="mb-5 text-step-1 font-extrabold text-on-dark">
                  {heading ? heading.label : `Links ${key}`}
                </h2>
                <ul className="flex flex-col gap-3.5">
                  {(heading ? links : [...(first ? [first] : []), ...rest]).filter((link) => link.url && link.url !== '#').map((link) => (
                    <li key={link.id}>
                      <SmartLink
                        href={link.url}
                        rel={link.rel ?? undefined}
                        target={link.target ?? undefined}
                        className="inline-flex w-fit items-center gap-2.5 text-step--1 font-medium text-on-dark-muted transition hover:text-primary-deep"
                      >
                        <span aria-hidden className="text-primary">
                          &rsaquo;
                        </span>
                        {link.label}
                      </SmartLink>
                    </li>
                  ))}
                </ul>
              </nav>
            )
          })}

          <div>
            <h2 className="mb-5 text-step-1 font-extrabold text-on-dark">Contact info</h2>
            <address className="flex flex-col gap-4 not-italic">
              <span className="flex gap-3 text-step--1 leading-relaxed text-on-dark-muted">
                <Icon name="location-dot" className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <span>
                  {organization.streetAddress}, {organization.addressLocality}, {organization.addressRegion}{' '}
                  {organization.postalCode}
                </span>
              </span>
              <a
                href={telHref(organization.phone)}
                className="flex gap-3 text-step--1 text-on-dark-muted transition hover:text-primary-deep"
              >
                <Icon name="phone" className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                {formatPhone(organization.phone)}
              </a>
              <a
                href={`mailto:${organization.email}`}
                className="flex gap-3 text-step--1 text-on-dark-muted transition hover:text-primary-deep"
              >
                <Icon name="envelope" className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                {organization.email}
              </a>
            </address>
            <p className="mt-4 flex items-center gap-2.5 text-step--1 font-semibold text-on-dark-muted">
              <span aria-hidden className="h-2 w-2 rounded-full bg-success" />
              24/7 dispatch — available now
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 py-7 text-step--1 text-on-dark-muted">
          <p>
            Copyright &copy; {year} {organization.name}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <SmartLink href="/privacy-policy" className="transition hover:text-primary-deep">
                Privacy policy
              </SmartLink>
            </li>
            <li>
              <SmartLink href="/terms" className="transition hover:text-primary-deep">
                Terms
              </SmartLink>
            </li>
            <li>
              <SmartLink href="/disclaimer" className="transition hover:text-primary-deep">
                Disclaimer
              </SmartLink>
            </li>
            <li>
              <SmartLink href="/sitemap" className="transition hover:text-primary-deep">
                Sitemap
              </SmartLink>
            </li>
            {/* The XML index is for crawlers, so it is a plain anchor rather
                than a client-routed link, and it is labelled as the machine
                version so a visitor is not surprised by raw XML. */}
            <li>
              <a href="/sitemap.xml" className="transition hover:text-primary-deep">
                Sitemap (XML)
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
