import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Shared presentational pieces for the admin. Light theme only, no dark toggle. */

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div>
        <h1 className="text-step-3">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-step--1 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </header>
  )
}

export function Panel({
  title,
  description,
  children,
  className,
  actions,
}: {
  title?: string
  description?: string
  children: ReactNode
  className?: string
  actions?: ReactNode
}) {
  return (
    <section className={cn('rounded-card border border-line bg-surface p-6', className)}>
      {title ? (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-step-1">{title}</h2>
            {description ? <p className="mt-1.5 text-step--1 text-muted">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function StatCard({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const body = (
    <>
      <dt className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-muted">{label}</dt>
      <dd className="mt-2 text-[1.9rem] font-extrabold leading-none text-ink">{value}</dd>
    </>
  )
  return href ? (
    <Link href={href} className="block rounded-card border border-line bg-surface p-5 transition hover:border-primary">
      <div>{body}</div>
    </Link>
  ) : (
    <div className="rounded-card border border-line bg-surface p-5">{body}</div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface-alt p-10 text-center">
      <h3 className="text-step-1">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-step--1 text-muted">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  )
}

const BADGE_TONES: Record<string, string> = {
  PUBLISHED: 'bg-success/15 text-[color:var(--color-success)]',
  DRAFT: 'bg-surface-alt text-muted',
  SCHEDULED: 'bg-primary-soft text-primary',
  ARCHIVED: 'bg-danger/10 text-[color:var(--color-danger)]',
  ADMIN: 'bg-primary-soft text-primary',
  EDITOR: 'bg-surface-alt text-ink',
  AUTHOR: 'bg-surface-alt text-muted',
}

export function Badge({ children, tone }: { children: string; tone?: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-pill px-2.5 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.08em]',
        BADGE_TONES[tone ?? children] ?? 'bg-surface-alt text-muted',
      )}
    >
      {children}
    </span>
  )
}

export function DataTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full min-w-[44rem] border-collapse text-step--1">
        <thead>
          <tr className="bg-surface-alt text-left">
            {head.map((cell) => (
              <th key={cell} scope="col" className="border-b border-line px-4 py-3 font-bold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Row({ children }: { children: ReactNode }) {
  return <tr className="border-b border-line last:border-0 hover:bg-surface-alt">{children}</tr>
}

export function Cell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 align-middle', className)}>{children}</td>
}
