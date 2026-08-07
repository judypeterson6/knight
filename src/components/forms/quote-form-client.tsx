'use client'

import { useMemo, useRef, useState, type FormEvent } from 'react'
import { cn } from '@/lib/utils'
import type { PublicForm, PublicFormField } from '@/lib/forms'

/**
 * Renders a form entirely from its database definition — labels, types,
 * required flags, options, conditional visibility and step grouping all come
 * from FormField rows, so /admin/forms controls what a visitor sees.
 *
 * Multi-step: when fields carry more than one distinct `step`, the form paginates.
 * The step indicator reflects real position, and "Next" refuses to advance while
 * a required field on the current step is empty — so the progress shown is never
 * ahead of what has actually been filled in.
 *
 * Accessibility: every control has a real <label> bound by id, required fields
 * are marked aria-required, validation and step changes are announced through an
 * aria-live region, and focus moves to the new step's heading on advance.
 */
export function QuoteFormClient({
  form,
  compact = false,
  hideDescription = false,
}: {
  form: PublicForm
  compact?: boolean
  /** Set when the surrounding block already says what the description says. */
  hideDescription?: boolean
}) {
  const [state, setState] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [values, setValues] = useState<Record<string, string>>({})
  const [stepIndex, setStepIndex] = useState(0)
  const [invalid, setInvalid] = useState<string[]>([])
  const formRef = useRef<HTMLFormElement>(null)
  const headingRef = useRef<HTMLParagraphElement>(null)

  /** Fields currently visible, respecting conditional `showWhen`. */
  const visible = useMemo(
    () => form.fields.filter((f) => !f.showWhen || checked[f.showWhen]),
    [form.fields, checked],
  )

  /** Distinct steps, in order, derived from the visible fields. */
  const steps = useMemo(() => {
    const byStep = new Map<number, PublicFormField[]>()
    for (const field of visible) {
      byStep.set(field.step, [...(byStep.get(field.step) ?? []), field])
    }
    return [...byStep.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([step, fields]) => ({
        step,
        title: fields.find((f) => f.stepTitle)?.stepTitle ?? '',
        fields,
      }))
  }, [visible])

  const multi = steps.length > 1
  const current = steps[Math.min(stepIndex, steps.length - 1)]
  const isLast = stepIndex >= steps.length - 1

  function setValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
    if (invalid.includes(name)) setInvalid((prev) => prev.filter((n) => n !== name))
  }

  /** Required fields on this step that are still empty. */
  function missingOnStep(): PublicFormField[] {
    return current.fields.filter((f) => {
      if (!f.required || f.type === 'HIDDEN') return false
      if (f.type === 'CHECKBOX') return !checked[f.name]
      return !(values[f.name] ?? '').trim()
    })
  }

  function goNext() {
    const missing = missingOnStep()
    if (missing.length) {
      setInvalid(missing.map((f) => f.name))
      setMessage(`Please complete: ${missing.map((f) => f.label).join(', ')}`)
      const first = formRef.current?.querySelector<HTMLElement>(`[name="${missing[0].name}"]`)
      first?.focus()
      return
    }
    setInvalid([])
    setMessage('')
    setStepIndex((i) => Math.min(i + 1, steps.length - 1))
    requestAnimationFrame(() => headingRef.current?.focus())
  }

  function goBack() {
    setInvalid([])
    setMessage('')
    setStepIndex((i) => Math.max(i - 1, 0))
    requestAnimationFrame(() => headingRef.current?.focus())
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // On a multi-step form, Enter mid-way should advance, not submit.
    if (multi && !isLast) {
      goNext()
      return
    }

    const missing = missingOnStep()
    if (missing.length) {
      setInvalid(missing.map((f) => f.name))
      setMessage(`Please complete: ${missing.map((f) => f.label).join(', ')}`)
      return
    }

    setState('submitting')
    setMessage('Sending your request…')

    const payload: Record<string, string> = { ...values }
    for (const [name, isChecked] of Object.entries(checked)) {
      if (isChecked) payload[name] = 'yes'
    }
    const honeypot = formRef.current?.querySelector<HTMLInputElement>('[name="company_website"]')
    if (honeypot?.value) payload.company_website = honeypot.value

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
            setValues({})
            setChecked({})
            setStepIndex(0)
          }}
          className="mt-6 font-bold text-primary underline underline-offset-2"
        >
          Send another request
        </button>
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={onSubmit}>
      {/* The intro paragraph is skipped in compact placements (inside a hero),
          where it pushes the fields below the fold for no added information. */}
      {form.description && stepIndex === 0 && !compact && !hideDescription ? (
        <p className="mb-6 text-step-0 text-muted">{form.description}</p>
      ) : null}

      {multi ? (
        <div className="mb-6">
          <ol className="flex flex-wrap gap-2" aria-label="Form steps">
            {steps.map((s, i) => (
              <li key={s.step} className="flex-1">
                <span
                  aria-current={i === stepIndex ? 'step' : undefined}
                  className={cn(
                    'block h-1.5 rounded-pill transition-colors',
                    i < stepIndex ? 'bg-primary' : i === stepIndex ? 'bg-primary' : 'bg-line',
                  )}
                />
                <span className="sr-only">
                  Step {i + 1}
                  {s.title ? `: ${s.title}` : ''}
                  {i < stepIndex ? ' (completed)' : i === stepIndex ? ' (current)' : ''}
                </span>
              </li>
            ))}
          </ol>
          <p
            ref={headingRef}
            tabIndex={-1}
            className="mt-4 text-step--1 font-bold uppercase tracking-[0.1em] text-primary"
          >
            Step {stepIndex + 1} of {steps.length}
            {current.title ? <span className="ml-2 normal-case tracking-normal text-ink">{current.title}</span> : null}
          </p>
        </div>
      ) : null}

      {/* Honeypot. Real visitors never see or fill this. */}
      <div aria-hidden className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
        <label htmlFor={`${form.slug}-company-website`}>Leave this field empty</label>
        <input id={`${form.slug}-company-website`} name="company_website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className={cn('grid gap-x-6 gap-y-5', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
        {current.fields.map((field) => (
          <Field
            key={field.id}
            field={field}
            formSlug={form.slug}
            compact={compact}
            value={values[field.name] ?? ''}
            checked={Boolean(checked[field.name])}
            invalid={invalid.includes(field.name)}
            onValue={setValue}
            onCheckedChange={(name, value) => setChecked((prev) => ({ ...prev, [name]: value }))}
          />
        ))}
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          'mt-5 text-step--1',
          state === 'error' || invalid.length ? 'text-danger' : 'text-muted',
          !message && 'sr-only',
        )}
      >
        {message}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {multi && stepIndex > 0 ? (
          <button type="button" onClick={goBack} className="kc-btn kc-btn-outline">
            Back
          </button>
        ) : null}

        {multi && !isLast ? (
          <button type="button" onClick={goNext} className="kc-btn kc-btn-primary">
            Next
          </button>
        ) : (
          <button type="submit" disabled={state === 'submitting'} className="kc-btn kc-btn-primary disabled:opacity-60">
            {state === 'submitting' ? 'Sending…' : form.submitLabel}
          </button>
        )}
      </div>
    </form>
  )
}

function Field({
  field,
  formSlug,
  compact,
  value,
  checked,
  invalid,
  onValue,
  onCheckedChange,
}: {
  field: PublicFormField
  formSlug: string
  compact: boolean
  value: string
  checked: boolean
  invalid: boolean
  onValue: (name: string, value: string) => void
  onCheckedChange: (name: string, value: boolean) => void
}) {
  const id = `${formSlug}-${field.name}`
  const describedBy = field.helpText ? `${id}-help` : undefined
  const wrapperClass = cn(field.halfWidth && !compact ? '' : 'sm:col-span-2')

  if (field.type === 'HIDDEN') {
    return <input type="hidden" id={id} name={field.name} value={field.placeholder ?? ''} readOnly />
  }

  if (field.type === 'CHECKBOX') {
    return (
      <div className={wrapperClass}>
        <label htmlFor={id} className="flex cursor-pointer items-center gap-3 text-step-0 font-semibold">
          <input
            id={id}
            name={field.name}
            type="checkbox"
            checked={checked}
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

  const shared = {
    id,
    name: field.name,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onValue(field.name, e.target.value),
    required: field.required,
    'aria-required': field.required,
    'aria-invalid': invalid || undefined,
    'aria-describedby': describedBy,
    placeholder: field.placeholder ?? undefined,
    className: cn('kc-field', invalid && '!border-danger'),
  }

  return (
    <div className={wrapperClass}>
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

      {field.type === 'TEXTAREA' ? (
        <textarea {...shared} rows={5} className={cn('kc-field resize-y', invalid && '!border-danger')} />
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
