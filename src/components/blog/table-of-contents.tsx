'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { TocItem } from '@/lib/toc'

/**
 * Sticky contents list for a long guide.
 *
 * Plain anchor links, so it works with no JavaScript at all. The client code
 * only adds the highlight showing which section is on screen, using an
 * IntersectionObserver rather than a scroll handler so it costs nothing on the
 * main thread while scrolling.
 *
 * The observer's root margin pulls the trigger line near the top of the
 * viewport, which is where a reader considers a section to have started.
 */
export function TableOfContents({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null)

    if (!headings.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const onScreen = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (onScreen[0]) setActiveId(onScreen[0].target.id)
      },
      { rootMargin: '-96px 0px -70% 0px', threshold: 0 },
    )

    for (const heading of headings) observer.observe(heading)
    return () => observer.disconnect()
  }, [items])

  if (items.length < 3) return null

  return (
    <nav aria-labelledby="toc-heading" className="lg:sticky lg:top-28">
      <h2 id="toc-heading" className="text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-subtle">
        On this page
      </h2>
      <ol className="mt-4 space-y-0.5 border-l border-line">
        {items.map((item) => {
          const active = item.id === activeId
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'block border-l-2 py-1.5 text-step--1 leading-snug transition',
                  item.level === 3 ? 'pl-7' : 'pl-4',
                  active
                    ? 'border-primary font-bold text-primary'
                    : 'border-transparent text-muted hover:border-line hover:text-ink',
                )}
              >
                {item.text}
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
