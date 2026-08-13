'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { SmartLink } from '@/components/ui/primitives'

export interface Step {
  icon: string
  title: string
  description: string
  url: string
  linkLabel: string
}

/**
 * The booking steps as a tablist.
 *
 * The interaction is added on top of a complete page, not in place of one.
 * Before hydration — which is also what a crawler and a visitor without
 * JavaScript get — every step renders with its description visible as an
 * ordinary ordered list. Once mounted, the same markup becomes a tablist where
 * one step is expanded at a time.
 *
 * That ordering matters: building it the other way round, with panels hidden in
 * the server HTML and revealed by script, would drop three quarters of the
 * section's text from the page for anyone whose JavaScript never runs.
 *
 * Keyboard behaviour follows the tabs pattern: arrows move between steps, Home
 * and End jump to the ends, and the selected tab is the only one in the tab
 * order, so a keyboard user tabs past the whole strip in one press.
 */
export function StepsStepper({ items }: { items: Step[] }) {
  const [mounted, setMounted] = useState(false)
  const [active, setActive] = useState(0)
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([])
  const base = useId()

  useEffect(() => setMounted(true), [])

  const tabId = (i: number) => `${base}-tab-${i}`
  const panelId = (i: number) => `${base}-panel-${i}`

  const focusTab = (i: number) => {
    const next = (i + items.length) % items.length
    setActive(next)
    tabsRef.current[next]?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowDown: active + 1,
      ArrowLeft: active - 1,
      ArrowUp: active - 1,
      Home: 0,
      End: items.length - 1,
    }
    if (!(e.key in map)) return
    e.preventDefault()
    focusTab(map[e.key])
  }

  return (
    <div>
      <ol
        role={mounted ? 'tablist' : undefined}
        aria-label={mounted ? 'Booking steps' : undefined}
        onKeyDown={mounted ? onKeyDown : undefined}
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        {items.map((item, i) => {
          const selected = mounted && i === active

          const inner = (
            <>
              <div className="mb-6 flex items-center justify-between">
                <span
                  className={cn(
                    'relative flex h-16 w-16 items-center justify-center rounded-[18px] border transition',
                    selected ? 'border-primary bg-primary text-primary-contrast' : 'border-line bg-surface text-primary',
                  )}
                >
                  <Icon name={item.icon} className="h-6 w-6" />
                  <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-surface bg-primary text-[0.75rem] font-extrabold text-primary-contrast">
                    {i + 1}
                  </span>
                </span>
                <span aria-hidden className="text-[3.2rem] font-black leading-none text-line">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <h3>{item.title}</h3>
              {/* Pre-hydration this carries the step's full text. Once the
                  tablist is live the detail moves to the panel below, so it is
                  never stated twice. */}
              {!mounted ? (
                <p className="mt-3 text-step--1 leading-relaxed text-muted">{item.description}</p>
              ) : null}
            </>
          )

          const shell = cn(
            'h-full w-full rounded-card border p-7 text-left transition',
            selected ? 'border-primary bg-surface shadow-card' : 'border-line bg-surface-alt',
          )

          return (
            <li key={item.title} role={mounted ? 'presentation' : undefined}>
              {mounted ? (
                <button
                  type="button"
                  role="tab"
                  id={tabId(i)}
                  aria-selected={selected}
                  aria-controls={panelId(i)}
                  tabIndex={selected ? 0 : -1}
                  ref={(el) => {
                    tabsRef.current[i] = el
                  }}
                  onClick={() => setActive(i)}
                  className={cn(shell, 'cursor-pointer hover:-translate-y-0.5 hover:shadow-card')}
                >
                  {inner}
                </button>
              ) : (
                <div className={shell}>{inner}</div>
              )}
            </li>
          )
        })}
      </ol>

      {/* Panels exist only once the tablist does, so the description is never
          duplicated into the server HTML as hidden text. */}
      {mounted
        ? items.map((item, i) => (
            <div
              key={item.title}
              role="tabpanel"
              id={panelId(i)}
              aria-labelledby={tabId(i)}
              hidden={i !== active}
              tabIndex={0}
              className="mt-6 rounded-card border border-line bg-surface-alt p-7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <p className="text-step-0 leading-relaxed text-muted">{item.description}</p>
              {item.url ? (
                <SmartLink href={item.url} className="kc-btn kc-btn-primary mt-6">
                  {item.linkLabel || `Go to ${item.title.toLowerCase()}`}
                </SmartLink>
              ) : null}
            </div>
          ))
        : null}
    </div>
  )
}
