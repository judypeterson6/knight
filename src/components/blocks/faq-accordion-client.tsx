'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface FaqEntry {
  id: string
  question: string
  answer: string
}

/**
 * Progressive-enhancement accordion.
 *
 * Every answer is already in the HTML the server sent. On mount we set
 * `html.js`, which is the only thing that lets the CSS collapse an answer. So:
 *   - crawler / no-JS: all answers rendered and visible
 *   - with JS: answers collapse, first one open, click toggles
 * Nothing is ever fetched or injected on click.
 */
export function FaqAccordionClient({ items }: { items: FaqEntry[] }) {
  const [enhanced, setEnhanced] = useState(false)
  const [open, setOpen] = useState(0)

  useEffect(() => {
    document.documentElement.classList.add('js')
    setEnhanced(true)
  }, [])

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => {
        const isOpen = !enhanced || open === index
        const panelId = `faq-panel-${item.id}`
        const buttonId = `faq-button-${item.id}`
        return (
          <div
            key={item.id}
            className={cn(
              'overflow-hidden rounded-card border transition-colors duration-300',
              isOpen ? 'border-primary/40 bg-surface shadow-card' : 'border-line bg-surface-alt',
            )}
          >
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(open === index ? -1 : index)}
                className="flex w-full items-center gap-5 px-6 py-5 text-left font-heading"
              >
                <span
                  aria-hidden
                  className={cn(
                    'min-w-5 text-[0.875rem] font-black transition-colors',
                    isOpen ? 'text-primary' : 'text-subtle',
                  )}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 text-[1.03rem] font-bold leading-snug">{item.question}</span>
                <span
                  aria-hidden
                  className={cn(
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xl font-normal transition-all duration-300',
                    isOpen ? 'rotate-[135deg] bg-primary text-primary-contrast' : 'bg-primary-soft text-primary',
                  )}
                >
                  +
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              data-open={isOpen}
              className="kc-faq-answer"
            >
              <div>
                <p className="px-6 pb-6 pl-[4.1rem] text-step--1 leading-[1.75] text-muted">{item.answer}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
