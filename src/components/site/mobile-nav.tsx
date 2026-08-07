'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Icon } from '@/components/ui/icon'

interface NavItem {
  id: string
  label: string
  url: string
}

/**
 * Mobile navigation drawer.
 *
 * Keyboard-navigable: Escape closes it, focus moves into the drawer on open and
 * returns to the trigger on close, and the page behind is inert to scroll.
 */
export function MobileNav({
  items,
  phoneHref,
  phoneLabel,
  logo,
}: {
  items: NavItem[]
  phoneHref: string
  phoneLabel: string
  logo: { src: string; alt: string; width: number; height: number }
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open])

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="ml-3 flex w-13 items-center justify-center rounded-[12px] bg-primary px-4 text-primary-contrast xl:hidden"
      >
        <span className="sr-only">Open menu</span>
        <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden focusable="false">
          <rect width="20" height="2" rx="1" fill="currentColor" />
          <rect y="7" width="20" height="2" rx="1" fill="currentColor" />
          <rect y="14" width="20" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>

      <div
        onClick={close}
        aria-hidden
        className={`fixed inset-0 z-[110] bg-black/55 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div
        id="mobile-nav"
        role="dialog"
        aria-modal={open}
        aria-label="Site menu"
        // React 19 takes a real boolean here; the old empty-string form is
        // read as `false`, which would leave the closed panel focusable.
        inert={!open}
        className={`fixed inset-y-0 right-0 z-[120] w-[min(330px,86vw)] overflow-y-auto bg-surface p-6 transition-transform duration-300 ease-smooth ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="mb-7 flex items-center justify-between">
          <Image src={logo.src} alt={logo.alt} width={logo.width} height={logo.height} className="h-[46px] w-auto" />
          <button ref={closeRef} type="button" onClick={close} className="p-2 text-2xl text-primary">
            <span className="sr-only">Close menu</span>
            <span aria-hidden>&#10005;</span>
          </button>
        </div>

        <nav aria-label="Mobile">
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.url}
                  onClick={close}
                  className="block border-b border-line py-4 text-step-1 font-semibold"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <a
          href={phoneHref}
          onClick={close}
          className="mt-7 flex items-center justify-center gap-2.5 rounded-[12px] bg-primary p-4 font-extrabold text-primary-contrast"
        >
          <Icon name="phone" className="h-4 w-4" />
          {phoneLabel}
        </a>
      </div>
    </>
  )
}
