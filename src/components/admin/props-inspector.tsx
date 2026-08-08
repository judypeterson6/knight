'use client'

import { createContext, useContext, useId, useRef, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { BlockType } from '@/lib/blocks/schema'
import { RichTextEditor } from '@/components/admin/rich-text-editor'

export interface MediaOption {
  id: string
  path: string
  alt: string
  decorative: boolean
  filename: string
  width: number | null
  height: number | null
}

/**
 * Assets uploaded during this editing session.
 *
 * The media list is fetched on the server when the page loads, so an image
 * uploaded from inside a block would not appear in any other picker until a
 * full reload. Holding the new records here keeps every picker on the screen in
 * step without re-fetching or threading a callback through the whole field tree.
 */
const SessionMediaContext = createContext<{ extra: MediaOption[]; add: (item: MediaOption) => void }>({
  extra: [],
  add: () => {},
})

/**
 * Right-rail inspector.
 *
 * Fields are derived from the block's live prop values, so the editor always
 * matches the Zod schema without a second field definition to keep in sync:
 *   - the shared background / spacing / alignment tokens render as selects
 *   - long-form keys render as textareas
 *   - `{ src, alt, ... }` renders as a media picker with a required alt field
 *   - `{ label, url, style }` renders as a CTA editor
 *   - arrays of objects render as repeaters with add, reorder and delete
 */
export function PropsInspector({
  blockType,
  label,
  description,
  props,
  media,
  onChange,
}: {
  blockType: BlockType
  label: string
  description: string
  props: Record<string, unknown>
  media: MediaOption[]
  onChange: (props: Record<string, unknown>) => void
}) {
  function set(key: string, value: unknown) {
    onChange({ ...props, [key]: value })
  }

  const layoutKeys = ['background', 'spacing', 'align', 'anchor', 'className']
  const contentKeys = Object.keys(props).filter((k) => !layoutKeys.includes(k))
  const [sessionMedia, setSessionMedia] = useState<MediaOption[]>([])

  return (
    <SessionMediaContext.Provider
      value={{ extra: sessionMedia, add: (item) => setSessionMedia((prev) => [item, ...prev]) }}
    >
    <div>
      <h2 className="text-step-0 font-extrabold">{label}</h2>
      <p className="mt-1 text-step--1 leading-relaxed text-muted">{description}</p>
      <p className="mt-1 font-mono text-[0.68rem] text-subtle">{blockType}</p>

      <div className="mt-5 space-y-4">
        {contentKeys.map((key) => (
          <PropField key={key} name={key} value={props[key]} media={media} onChange={(v) => set(key, v)} />
        ))}
      </div>

      <details className="mt-6 rounded-control border border-line p-3">
        <summary className="cursor-pointer text-step--1 font-bold">Spacing, background and alignment</summary>
        <div className="mt-3 space-y-3">
          <Select
            label="Background"
            value={String(props.background ?? 'surface')}
            options={['surface', 'alt', 'dark', 'primary', 'none']}
            onChange={(v) => set('background', v)}
          />
          <Select
            label="Vertical spacing"
            value={String(props.spacing ?? 'md')}
            options={['none', 'sm', 'md', 'lg']}
            onChange={(v) => set('spacing', v)}
          />
          <Select
            label="Alignment"
            value={String(props.align ?? 'left')}
            options={['left', 'center']}
            onChange={(v) => set('align', v)}
          />
          <Text label="Anchor id" value={String(props.anchor ?? '')} onChange={(v) => set('anchor', v)} help="Lets a menu item link straight to this section." />
          <Text label="Extra CSS class" value={String(props.className ?? '')} onChange={(v) => set('className', v)} />
        </div>
      </details>
    </div>
    </SessionMediaContext.Provider>
  )
}

const LONG_KEYS = new Set([
  'body',
  'html',
  'statement',
  'description',
  'answer',
  'supportBody',
  'excludedNote',
  'definition',
  'successBody',
])

function isImageValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'src' in value && 'alt' in value)
}

function isCtaValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'label' in value && 'url' in value)
}

function humanize(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

function PropField({
  name,
  value,
  media,
  onChange,
}: {
  name: string
  value: unknown
  media: MediaOption[]
  onChange: (value: unknown) => void
}) {
  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center gap-3 text-step--1 font-semibold">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-[18px] w-[18px] accent-[var(--color-primary)]"
        />
        {humanize(name)}
      </label>
    )
  }

  if (typeof value === 'number') {
    return (
      <Text label={humanize(name)} value={String(value)} type="number" onChange={(v) => onChange(Number(v) || 0)} />
    )
  }

  if (name === 'headingLevel') {
    return <Select label="Heading level" value={String(value)} options={['h1', 'h2', 'h3']} onChange={onChange} />
  }
  if (name === 'variant') {
    return <Select label="Variant" value={String(value)} options={['landing', 'page']} onChange={onChange} />
  }
  if (name === 'layout') {
    return <Select label="Layout" value={String(value)} options={['split', 'stacked']} onChange={onChange} />
  }
  if (name === 'imagePosition') {
    return <Select label="Image position" value={String(value)} options={['none', 'left', 'right']} onChange={onChange} />
  }
  if (name === 'maxWidth') {
    return <Select label="Text width" value={String(value)} options={['prose', 'full']} onChange={onChange} />
  }
  if (name === 'columns') {
    return <Select label="Columns" value={String(value)} options={['2', '3', '4']} onChange={(v) => onChange(Number(v))} />
  }

  if (typeof value === 'string') {
    // Prose fields get the same editor the blog uses, so bold, links, lists and
    // headings are available in every block rather than only in RichText. The
    // renderer keeps plain values on their original markup, so existing copy is
    // untouched until someone actually applies formatting.
    if (LONG_KEYS.has(name)) {
      return (
        <div>
          <p className="kc-label">{humanize(name)}</p>
          <RichTextEditor value={value} onChange={onChange} media={media} />
        </div>
      )
    }
    return <Text label={humanize(name)} value={value} onChange={onChange} />
  }

  if (isImageValue(value)) {
    return <ImagePicker label={humanize(name)} value={value} media={media} onChange={onChange} />
  }

  if (isCtaValue(value)) {
    return <CtaEditor label={humanize(name)} value={value} onChange={onChange} />
  }

  if (Array.isArray(value)) {
    return <Repeater label={humanize(name)} items={value} media={media} onChange={onChange} />
  }

  return null
}

function Repeater({
  label,
  items,
  media,
  onChange,
}: {
  label: string
  items: unknown[]
  media: MediaOption[]
  onChange: (value: unknown[]) => void
}) {
  const [open, setOpen] = useState<number | null>(items.length ? 0 : null)

  function template(): unknown {
    const first = items[0]
    if (first && typeof first === 'object') {
      const clone = structuredClone(first) as Record<string, unknown>
      for (const key of Object.keys(clone)) {
        if (typeof clone[key] === 'string') clone[key] = ''
        if (Array.isArray(clone[key])) clone[key] = []
      }
      return clone
    }
    return typeof first === 'string' ? '' : {}
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <fieldset className="rounded-control border border-line p-3">
      <legend className="px-1 text-step--1 font-bold">
        {label} ({items.length})
      </legend>

      <ul className="space-y-2">
        {items.map((item, index) => {
          const isObject = item && typeof item === 'object' && !Array.isArray(item)
          const summary = isObject
            ? String(
                (item as Record<string, unknown>).title ??
                  (item as Record<string, unknown>).label ??
                  (item as Record<string, unknown>).text ??
                  (item as Record<string, unknown>).name ??
                  (item as Record<string, unknown>).term ??
                  (item as Record<string, unknown>).value ??
                  (item as Record<string, unknown>).city ??
                  (item as Record<string, unknown>).code ??
                  `Item ${index + 1}`,
              )
            : String(item)

          return (
            <li key={index} className="rounded-control border border-line bg-surface-alt">
              <div className="flex items-center gap-1 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setOpen(open === index ? null : index)}
                  aria-expanded={open === index}
                  className="flex-1 truncate text-left text-step--1 font-semibold"
                >
                  {summary || `Item ${index + 1}`}
                </button>
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="px-1 disabled:opacity-30" aria-label="Move up">
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  className="px-1 disabled:opacity-30"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                  className="px-1 text-danger"
                  aria-label={`Delete ${summary}`}
                >
                  ✕
                </button>
              </div>

              {open === index ? (
                <div className="space-y-3 border-t border-line p-3">
                  {isObject ? (
                    Object.entries(item as Record<string, unknown>).map(([key, childValue]) => (
                      <PropField
                        key={key}
                        name={key}
                        value={childValue}
                        media={media}
                        onChange={(v) => {
                          const next = [...items]
                          next[index] = { ...(item as Record<string, unknown>), [key]: v }
                          onChange(next)
                        }}
                      />
                    ))
                  ) : (
                    <Text
                      label="Value"
                      value={String(item)}
                      onChange={(v) => {
                        const next = [...items]
                        next[index] = v
                        onChange(next)
                      }}
                    />
                  )}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={() => {
          onChange([...items, template()])
          setOpen(items.length)
        }}
        className="mt-2 w-full rounded-control border border-dashed border-line py-2 text-step--1 font-bold text-primary"
      >
        Add item
      </button>
    </fieldset>
  )
}

function ImagePicker({
  label,
  value,
  media,
  onChange,
}: {
  label: string
  value: Record<string, unknown>
  media: MediaOption[]
  onChange: (value: Record<string, unknown>) => void
}) {
  const src = String(value.src ?? '')
  const alt = String(value.alt ?? '')
  const decorative = value.decorative === true
  const session = useContext(SessionMediaContext)

  // Session uploads first, so an image just uploaded from this field is at the
  // top of the list rather than buried in 900-odd migrated assets.
  const options = [...session.extra, ...media.filter((m) => !session.extra.some((e) => e.path === m.path))]

  return (
    <fieldset className="rounded-control border border-line p-3">
      <legend className="px-1 text-step--1 font-bold">{label}</legend>

      {src ? (
        <div className="mb-3 overflow-hidden rounded-control border border-line bg-surface-alt">
          <Image
            src={src}
            alt={alt || 'Selected image preview'}
            width={Number(value.width) || 320}
            height={Number(value.height) || 200}
            className="h-28 w-full object-cover"
          />
        </div>
      ) : null}

      <label htmlFor={`img-${label}`} className="kc-label">
        Image
      </label>
      <select
        id={`img-${label}`}
        value={src}
        onChange={(e) => {
          const chosen = options.find((m) => m.path === e.target.value)
          onChange({
            ...value,
            src: e.target.value,
            alt: chosen ? chosen.alt : alt,
            decorative: chosen ? chosen.decorative : decorative,
            width: chosen?.width ?? (Number(value.width) || 1024),
            height: chosen?.height ?? (Number(value.height) || 691),
          })
        }}
        className="kc-field"
      >
        <option value="">None</option>
        {options.map((option) => (
          <option key={option.id} value={option.path}>
            {option.filename}
            {option.alt ? '' : ' (no alt text)'}
          </option>
        ))}
      </select>

      <MediaUploader
        onUploaded={(item) => {
          session.add(item)
          onChange({
            ...value,
            src: item.path,
            alt: item.alt,
            decorative: item.decorative,
            width: item.width ?? 1024,
            height: item.height ?? 691,
          })
        }}
      />

      <div className="mt-3">
        <Text
          label="Alt text"
          value={alt}
          onChange={(v) => onChange({ ...value, alt: v })}
          help={
            src && !alt && !decorative
              ? 'Required. An image cannot be saved into content without alt text unless it is marked decorative.'
              : 'What the image conveys, in a sentence.'
          }
        />
        {src && !alt && !decorative ? (
          <p role="alert" className="mt-1 text-step--1 font-bold text-danger">
            This block will not save until alt text is set or the image is marked decorative.
          </p>
        ) : null}
      </div>

      <label className="mt-3 flex items-center gap-3 text-step--1 font-semibold">
        <input
          type="checkbox"
          checked={decorative}
          onChange={(e) => onChange({ ...value, decorative: e.target.checked, alt: e.target.checked ? '' : alt })}
          className="h-[18px] w-[18px] accent-[var(--color-primary)]"
        />
        Decorative — carries no information
      </label>

      <div className="mt-3">
        <Text label="Caption" value={String(value.caption ?? '')} onChange={(v) => onChange({ ...value, caption: v })} help="Rendered as a figcaption. Say what the image shows." />
      </div>
    </fieldset>
  )
}

/**
 * Upload straight into the block being edited.
 *
 * Every image field previously offered only the assets already in the library,
 * so adding a new picture meant leaving the page for /admin/media and coming
 * back. The upload posts to the same endpoint the media library uses, which is
 * what enforces the type and size limits and refuses an image with no alt text
 * — that rule is not re-implemented here, only surfaced.
 */
function MediaUploader({ onUploaded }: { onUploaded: (item: MediaOption) => void }) {
  const fieldId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [alt, setAlt] = useState('')
  const [decorative, setDecorative] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const ready = Boolean(file) && (alt.trim().length > 0 || decorative)

  async function upload() {
    if (!file || !ready) return
    setBusy(true)
    setMessage('Uploading…')

    const body = new FormData()
    body.append('files', file)
    body.append('alt', alt.trim())
    body.append('decorative', String(decorative))

    try {
      const res = await fetch('/api/admin/media', { method: 'POST', body })
      const json = (await res.json()) as { ok: boolean; error?: string; data?: MediaOption[] }
      if (!json.ok || !json.data?.length) {
        setMessage(json.error ?? 'Upload failed.')
        return
      }
      onUploaded(json.data[0])
      setFile(null)
      setAlt('')
      setDecorative(false)
      if (inputRef.current) inputRef.current.value = ''
      setMessage('Uploaded and selected.')
    } catch {
      setMessage('Upload failed — check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="mt-3 rounded-control border border-dashed border-line p-3">
      <summary className="cursor-pointer text-step--1 font-bold text-primary">Upload a new image</summary>

      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor={`${fieldId}-file`} className="kc-label">
            Image file
          </label>
          <input
            id={`${fieldId}-file`}
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setMessage('')
            }}
            className="kc-field file:mr-3 file:rounded-control file:border-0 file:bg-surface-alt file:px-3 file:py-1.5 file:text-step--1 file:font-bold"
          />
          <p className="mt-1.5 text-step--1 text-subtle">PNG, JPEG, WebP, AVIF or SVG, up to 15 MB.</p>
        </div>

        <Text
          label="Alt text"
          value={alt}
          onChange={(v) => {
            setAlt(v)
            if (v.trim()) setDecorative(false)
          }}
          help="What the image conveys, in a sentence."
        />

        <label className="flex items-center gap-3 text-step--1 font-semibold">
          <input
            type="checkbox"
            checked={decorative}
            onChange={(e) => {
              setDecorative(e.target.checked)
              if (e.target.checked) setAlt('')
            }}
            className="h-[18px] w-[18px] accent-[var(--color-primary)]"
          />
          Decorative — carries no information
        </label>

        <button
          type="button"
          onClick={() => void upload()}
          disabled={!ready || busy}
          className="kc-btn kc-btn-primary w-full !py-2 !text-step--1 disabled:opacity-50"
        >
          {busy ? 'Uploading…' : 'Upload and use'}
        </button>

        <p role="status" aria-live="polite" className={cn('text-step--1', message ? 'text-muted' : 'sr-only')}>
          {message}
        </p>

        {file && !ready ? (
          <p className="text-step--1 font-bold text-danger">
            Add alt text, or mark the image decorative, before uploading.
          </p>
        ) : null}
      </div>
    </details>
  )
}

function CtaEditor({
  label,
  value,
  onChange,
}: {
  label: string
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
}) {
  return (
    <fieldset className="rounded-control border border-line p-3">
      <legend className="px-1 text-step--1 font-bold">{label}</legend>
      <div className="space-y-3">
        <Text label="Button text" value={String(value.label ?? '')} onChange={(v) => onChange({ ...value, label: v })} />
        <Text
          label="URL"
          value={String(value.url ?? '')}
          onChange={(v) => onChange({ ...value, url: v })}
          help="Must point at a real page. A button that links to # is not shipped."
        />
        <Select
          label="Style"
          value={String(value.style ?? 'primary')}
          options={['primary', 'outline', 'ghost']}
          onChange={(v) => onChange({ ...value, style: v })}
        />
      </div>
    </fieldset>
  )
}

export function Text({
  label,
  value,
  onChange,
  help,
  multiline,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  help?: string
  multiline?: boolean
  type?: string
}) {
  const id = `prop-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div>
      <label htmlFor={id} className="kc-label">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} rows={5} value={value} onChange={(e) => onChange(e.target.value)} className={cn('kc-field resize-y', label === 'Html' && 'font-mono text-step--1')} />
      ) : (
        <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="kc-field" />
      )}
      {help ? <p className="mt-1.5 text-step--1 text-subtle">{help}</p> : null}
    </div>
  )
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  const id = `select-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div>
      <label htmlFor={id} className="kc-label">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="kc-field">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}
