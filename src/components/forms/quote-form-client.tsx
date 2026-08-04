'use client'

import { useState, type FormEvent } from 'react'
import { cn } from '@/lib/utils'
import type { PublicForm, PublicFormField } from '@/lib/forms'

/**
 * Renders a form entirely from its database definition — labels, types,
 * required flags, options and conditional visibility all come from FormField
 * rows, so /admin/forms controls what a visitor sees.
 *
 * Accessibility: every control has a real <label> bound by id, required fields
 * are marked with aria-required, validation errors are announced through an
 * aria-live region, and the success state moves focus to the confirmation.
 */
export function QuoteFormClient({ form, compact = false }: { form: PublicForm; compact?: boolean }) {
  const [state, setState] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('submitting')
    setMessage('Sending your request…')

    const formData = new FormData(event.currentTarget)
    const payload: Record<string, string> = {}
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') payload[key] = value
    }

    try {
      const res = await fetch(`/api/forms/${form.slug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !body.ok) {
        setState('error')
        setMessage(body.error ?? 'Something went wrong. Please call us and we will take the details by phone.')
        return
      }
      setState('sent')
      setMessage(form.successTitle)
    } catch {
      setState('error')
      setMessage('We could not reach the server. Please call us and we will take the details by phone.')
    }
  }

  if (state === 'sent') {
    return (
      <div className="text-center" role="status" aria-live="polite">
        <h3 className="text-step-3">{form.successTitle}</h3>
        <p className="mx-auto mt-3 max-w-md text-step-0 text-muted">{form.successBody}</p>
        <button
          type="button"
          onClick={() => {
            setState('idle')
            setMessage('')
          }}
          className="mt-6 font-bold text-primary underline underline-offset-2"
        >
          Send another request
        </button>
      </div>
    )
  }

  const visible = form.fields.filter((f) => !f.showWhen || checked[f.showWhen])

  return (
    <form onSubmit={onSubmit} noValidate={false}>
      {form.description ? <p className="mb-6 text-step-0 text-muted">{form.description}</p> : null}

      {/* Honeypot. Real visitors never see or fill this. */}
      <div aria-hidden className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
        <label htmlFor={`${form.slug}-company-website`}>Leave this field empty</label>
        <input id={`${form.slug}-company-website`} name="company_website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className={cn('grid gap-x-6 gap-y-5', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
        {visible.map((field) => (
          <Field
            key={field.id}
            field={field}
            formSlug={form.slug}
            compact={compact}
            onCheckedChange={(name, value) => setChecked((prev) => ({ ...prev, [name]: value }))}
          />
        ))}
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          'mt-5 text-step--1',
          state === 'error' ? 'text-danger' : 'text-muted',
          !message && 'sr-only',
        )}
      >
        {message}
      </p>

      <button type="submit" disabled={state === 'submitting'} className="kc-btn kc-btn-primary mt-6 disabled:opacity-60">
        {state === 'submitting' ? 'Sending…' : form.submitLabel}
      </button>
    </form>
  )
}

function Field({
  field,
  formSlug,
  compact,
  onCheckedChange,
}: {
  field: PublicFormField
  formSlug: string
  compact: boolean
  onCheckedChange: (name: string, value: boolean) => void
}) {
  const id = `${formSlug}-${field.name}`
  const describedBy = field.helpText ? `${id}-help` : undefined
  const wrapperClass = cn(field.halfWidth && !compact ? '' : 'sm:col-span-2')

  if (field.type === 'HIDDEN') {
    return <input type="hidden" id={id} name={field.name} value={field.placeholder ?? ''} />
  }

  if (field.type === 'CHECKBOX') {
    return (
      <div className={wrapperClass}>
        <label htmlFor={id} className="flex cursor-pointer items-center gap-3 text-step-0 font-semibold">
          <input
            id={id}
            name={field.name}
            type="checkbox"
            value="yes"
            required={field.required}
            aria-required={field.required}
            aria-describedby={describedBy}
            onChange={(e) => onCheckedChange(field.name, e.target.checked)}
            className="h-[18px] w-[18px] accent-[var(--color-primary)]"
          />
          {field.label}
        </label>
        {field.helpText ? (
          <p id={describedBy} className="mt-2 text-step--1 text-subtle">
            {field.helpText}
          </p>
        ) : null}
      </div>
    )
  }

  const label = (
    <label htmlFor={id} className="kc-label">
      {field.label}
      {field.required ? (
        <>
          {' '}
          <span className="text-danger" aria-hidden>
            *
          </span>
          <span className="sr-only">(required)</span>
        </>
      ) : null}
    </label>
  )

  const shared = {
    id,
    name: field.name,
    required: field.required,
    'aria-required': field.required,
    'aria-describedby': describedBy,
    placeholder: field.placeholder ?? undefined,
    className: 'kc-field',
  }

  return (
    <div className={wrapperClass}>
      {label}
      {field.type === 'TEXTAREA' ? (
        <textarea {...shared} rows={5} className="kc-field resize-y" />
      ) : field.type === 'SELECT' ? (
        <select {...shared}>
          <option value="">Please select…</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...shared}
          type={
            field.type === 'EMAIL'
              ? 'email'
              : field.type === 'TEL'
                ? 'tel'
                : field.type === 'NUMBER'
                  ? 'number'
                  : field.type === 'DATE'
                    ? 'date'
                    : 'text'
          }
          {...(field.type === 'NUMBER' ? { min: 1 } : {})}
          autoComplete={autoCompleteFor(field)}
        />
      )}
      {field.helpText ? (
        <p id={describedBy} className="mt-1.5 text-step--1 text-subtle">
          {field.helpText}
        </p>
      ) : null}
    </div>
  )
}

function autoCompleteFor(field: PublicFormField): string | undefined {
  if (field.type === 'EMAIL') return 'email'
  if (field.type === 'TEL') return 'tel'
  if (/name/i.test(field.name)) return 'name'
  if (/organi[sz]ation|company|artist/i.test(field.name)) return 'organization'
  return undefined
}
