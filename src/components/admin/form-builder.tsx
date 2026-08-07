'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Text } from '@/components/admin/props-inspector'

interface FieldDraft {
  id: string
  name: string
  label: string
  type: string
  placeholder: string
  helpText: string
  required: boolean
  options: string[]
  order: number
  showWhen: string
  halfWidth: boolean
  step: number
  stepTitle: string
}

const TYPES = ['TEXT', 'EMAIL', 'TEL', 'NUMBER', 'DATE', 'TEXTAREA', 'SELECT', 'CHECKBOX', 'FILE', 'HIDDEN']

export function FormBuilder({
  slug,
  settings: initialSettings,
  fields: initialFields,
}: {
  slug: string
  settings: {
    name: string
    description: string
    submitLabel: string
    successTitle: string
    successBody: string
    notifyEmail: string
    enabled: boolean
  }
  fields: FieldDraft[]
}) {
  const router = useRouter()
  const [settings, setSettings] = useState(initialSettings)
  const [fields, setFields] = useState(initialFields)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function update(index: number, patch: Partial<FieldDraft>) {
    const next = [...fields]
    next[index] = { ...next[index], ...patch }
    setFields(next)
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= fields.length) return
    const next = [...fields]
    ;[next[index], next[target]] = [next[target], next[index]]
    setFields(next.map((f, i) => ({ ...f, order: i })))
  }

  async function save() {
    setBusy(true)
    setMessage('Saving…')

    const settingsRes = await fetch(`/api/admin/forms/${slug}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...settings, notifyEmail: settings.notifyEmail || null, description: settings.description || null }),
    })
    const settingsBody = (await settingsRes.json()) as { ok: boolean; error?: string }
    if (!settingsBody.ok) {
      setBusy(false)
      setMessage(settingsBody.error ?? 'Save failed.')
      return
    }

    const fieldsRes = await fetch(`/api/admin/forms/${slug}/fields`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fields: fields.map((field, index) => ({
          name: field.name,
          label: field.label,
          type: field.type,
          placeholder: field.placeholder || null,
          helpText: field.helpText || null,
          required: field.required,
          options: field.options.length ? field.options : null,
          order: index,
          showWhen: field.showWhen || null,
          halfWidth: field.halfWidth,
          step: field.step || 1,
          stepTitle: field.stepTitle || null,
        })),
      }),
    })
    const fieldsBody = (await fieldsRes.json()) as { ok: boolean; error?: string }

    setBusy(false)
    setMessage(fieldsBody.ok ? 'Form saved.' : (fieldsBody.error ?? 'Fields did not save.'))
    if (fieldsBody.ok) router.refresh()
  }

  const checkboxFields = fields.filter((f) => f.type === 'CHECKBOX')

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Text label="Form name" value={settings.name} onChange={(v) => setSettings({ ...settings, name: v })} />
        <Text label="Notification email" value={settings.notifyEmail} onChange={(v) => setSettings({ ...settings, notifyEmail: v })} help="Falls back to FORM_NOTIFY_EMAIL, then the business email." />
        <div className="sm:col-span-2">
          <Text label="Intro text" value={settings.description} multiline onChange={(v) => setSettings({ ...settings, description: v })} />
        </div>
        <Text label="Submit button label" value={settings.submitLabel} onChange={(v) => setSettings({ ...settings, submitLabel: v })} />
        <Text label="Success title" value={settings.successTitle} onChange={(v) => setSettings({ ...settings, successTitle: v })} />
        <div className="sm:col-span-2">
          <Text label="Success message" value={settings.successBody} multiline onChange={(v) => setSettings({ ...settings, successBody: v })} />
        </div>
        <label className="flex items-center gap-3 text-step--1 font-semibold">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            className="h-[18px] w-[18px] accent-[var(--color-primary)]"
          />
          Accepting submissions
        </label>
      </div>

      <h3 className="mb-3 text-step-0 font-extrabold">Fields ({fields.length})</h3>
      <ol className="space-y-3">
        {fields.map((field, index) => (
          <li key={field.id || index} className="rounded-card border border-line bg-surface-alt p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Text label="Label" value={field.label} onChange={(v) => update(index, { label: v })} />
              <Text label="Name" value={field.name} onChange={(v) => update(index, { name: v })} help="lowercase_with_underscores" />
              <div>
                <label htmlFor={`type-${index}`} className="kc-label">
                  Type
                </label>
                <select id={`type-${index}`} value={field.type} onChange={(e) => update(index, { type: e.target.value })} className="kc-field">
                  {TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`when-${index}`} className="kc-label">
                  Only show when
                </label>
                <select id={`when-${index}`} value={field.showWhen} onChange={(e) => update(index, { showWhen: e.target.value })} className="kc-field">
                  <option value="">Always</option>
                  {checkboxFields
                    .filter((f) => f.name !== field.name)
                    .map((f) => (
                      <option key={f.name} value={f.name}>
                        {f.label} is ticked
                      </option>
                    ))}
                </select>
              </div>
              <Text label="Placeholder" value={field.placeholder} onChange={(v) => update(index, { placeholder: v })} />
              <Text label="Help text" value={field.helpText} onChange={(v) => update(index, { helpText: v })} />
              <div>
                <label htmlFor={`step-${index}`} className="kc-label">
                  Step
                </label>
                <input
                  id={`step-${index}`}
                  type="number"
                  min={1}
                  max={10}
                  value={field.step}
                  onChange={(e) => update(index, { step: Number(e.target.value) || 1 })}
                  className="kc-field"
                />
                <p className="mt-1.5 text-step--1 text-subtle">
                  All fields on step 1 = a single-page form. A conditional field must share its trigger&rsquo;s step.
                </p>
              </div>
              <Text
                label="Step heading"
                value={field.stepTitle}
                onChange={(v) => update(index, { stepTitle: v })}
                help="Only read from the first field of each step."
              />
              {field.type === 'SELECT' ? (
                <div className="sm:col-span-2">
                  <label htmlFor={`options-${index}`} className="kc-label">
                    Options (one per line)
                  </label>
                  <textarea
                    id={`options-${index}`}
                    rows={4}
                    value={field.options.join('\n')}
                    onChange={(e) => update(index, { options: e.target.value.split('\n').filter((l) => l.trim()) })}
                    className="kc-field resize-y"
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-step--1 font-semibold">
                <input type="checkbox" checked={field.required} onChange={(e) => update(index, { required: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />
                Required
              </label>
              <label className="flex items-center gap-2 text-step--1 font-semibold">
                <input type="checkbox" checked={field.halfWidth} onChange={(e) => update(index, { halfWidth: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />
                Half width
              </label>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="px-2 disabled:opacity-30" aria-label={`Move ${field.label} up`}>
                  ↑
                </button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === fields.length - 1} className="px-2 disabled:opacity-30" aria-label={`Move ${field.label} down`}>
                  ↓
                </button>
                <button type="button" onClick={() => setFields(fields.filter((_, i) => i !== index))} className="px-2 text-danger" aria-label={`Delete ${field.label}`}>
                  ✕
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <p role="status" aria-live="polite" className={message ? 'mt-4 text-step--1 text-muted' : 'sr-only'}>
        {message}
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            setFields([
              ...fields,
              {
                id: `new-${fields.length}`,
                name: `field_${fields.length + 1}`,
                label: 'New field',
                type: 'TEXT',
                placeholder: '',
                helpText: '',
                required: false,
                options: [],
                order: fields.length,
                showWhen: '',
                halfWidth: true,
                step: fields[fields.length - 1]?.step ?? 1,
                stepTitle: '',
              },
            ])
          }
          className="kc-btn kc-btn-outline !px-5 !py-2.5"
        >
          Add field
        </button>
        <button type="button" onClick={() => void save()} disabled={busy} className="kc-btn kc-btn-primary !px-5 !py-2.5">
          {busy ? 'Saving…' : 'Save form'}
        </button>
      </div>
    </div>
  )
}
