'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type {
  BrandingSettings,
  FontSettings,
  HeadingSettings,
  OrganizationSettings,
  ScriptSettings,
  ThemeSettings,
  TrustSettings,
} from '@/lib/settings'
import { Text } from '@/components/admin/props-inspector'

type Tab = 'theme' | 'fonts' | 'headings' | 'logos' | 'business' | 'trust' | 'scripts' | 'css'

/** A curated list of Google Fonts, loaded through next/font at build time. */
const FONT_CHOICES = [
  'Montserrat',
  'Inter',
  'Manrope',
  'Poppins',
  'Roboto',
  'Open Sans',
  'Source Sans 3',
  'Work Sans',
  'DM Sans',
  'Plus Jakarta Sans',
  'Playfair Display',
  'Lora',
]

const COLOR_FIELDS: { key: keyof ThemeSettings; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'primaryHover', label: 'Primary (hover)' },
  { key: 'primaryContrast', label: 'On primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'surfaceAlt', label: 'Surface (alt)' },
  { key: 'surfaceDark', label: 'Surface (dark)' },
  { key: 'text', label: 'Text' },
  { key: 'muted', label: 'Muted text' },
  { key: 'subtle', label: 'Subtle text' },
  { key: 'border', label: 'Border' },
  { key: 'onDark', label: 'Text on dark' },
  { key: 'onDarkMuted', label: 'Muted on dark' },
  { key: 'success', label: 'Success' },
  { key: 'danger', label: 'Danger' },
]

export function AppearanceEditor(props: {
  theme: ThemeSettings
  fonts: FontSettings
  headings: HeadingSettings
  branding: BrandingSettings
  organization: OrganizationSettings
  trust: TrustSettings
  scripts: ScriptSettings
  customCss: { global: string }
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('theme')
  const [theme, setTheme] = useState(props.theme)
  const [fonts, setFonts] = useState(props.fonts)
  const [headings, setHeadings] = useState(props.headings)
  const [branding, setBranding] = useState(props.branding)
  const [organization, setOrganization] = useState(props.organization)
  const [trust, setTrust] = useState(props.trust)
  const [scripts, setScripts] = useState(props.scripts)
  const [customCss, setCustomCss] = useState(props.customCss)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(key: string, value: unknown) {
    setBusy(true)
    setMessage('Saving…')
    const res = await fetch(`/api/admin/settings/${key}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }
    setBusy(false)
    setMessage(body.ok ? 'Saved. The site has been revalidated.' : (body.error ?? 'Save failed.'))
    if (body.ok) router.refresh()
  }

  async function reset(key: string) {
    if (!window.confirm('Reset this group back to the shipped defaults?')) return
    setBusy(true)
    const res = await fetch(`/api/admin/settings/${key}`, { method: 'DELETE' })
    const body = (await res.json()) as { ok: boolean; error?: string }
    setBusy(false)
    setMessage(body.ok ? 'Reset to defaults.' : (body.error ?? 'Reset failed.'))
    if (body.ok) router.refresh()
  }

  const tabs: [Tab, string][] = [
    ['theme', 'Theme'],
    ['fonts', 'Fonts'],
    ['headings', 'Headings'],
    ['logos', 'Logos'],
    ['business', 'Business details'],
    ['trust', 'Certifications'],
    ['scripts', 'Scripts'],
    ['css', 'Custom CSS'],
  ]

  return (
    <div>
      <nav aria-label="Appearance sections" className="mb-6 flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-current={tab === key ? 'true' : undefined}
            className={cn(
              'rounded-pill px-4 py-2 text-step--1 font-bold',
              tab === key ? 'bg-primary text-primary-contrast' : 'bg-surface text-muted',
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      <p role="status" aria-live="polite" className={message ? 'mb-4 text-step--1 text-muted' : 'sr-only'}>
        {message}
      </p>

      {tab === 'theme' ? (
        <Section title="Colours, radii and layout" onSave={() => void save('theme', theme)} onReset={() => void reset('theme')} busy={busy}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COLOR_FIELDS.map((field) => (
              <div key={field.key}>
                <label htmlFor={`c-${field.key}`} className="kc-label">
                  {field.label}
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label={`${field.label} colour picker`}
                    value={/^#[0-9a-f]{6}$/i.test(theme[field.key]) ? theme[field.key] : '#000000'}
                    onChange={(e) => setTheme({ ...theme, [field.key]: e.target.value })}
                    className="h-11 w-12 flex-shrink-0 rounded-control border border-line"
                  />
                  <input
                    id={`c-${field.key}`}
                    value={theme[field.key]}
                    onChange={(e) => setTheme({ ...theme, [field.key]: e.target.value })}
                    className="kc-field font-mono"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(['radiusCard', 'radiusBlock', 'radiusPill', 'radiusControl', 'containerWidth', 'containerWidthWide', 'spaceSection', 'spaceSectionLg', 'spaceGutter'] as const).map((key) => (
              <Text key={key} label={key} value={theme[key]} onChange={(v) => setTheme({ ...theme, [key]: v })} />
            ))}
          </div>

          <div className="mt-6 rounded-card border border-line p-5" style={{ background: theme.surfaceAlt }}>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em]" style={{ color: theme.muted }}>
              Live preview
            </p>
            <p className="mt-2 text-step-2 font-extrabold" style={{ color: theme.text }}>
              Entertainer coach rental nationwide
            </p>
            <p className="mt-2 text-step--1" style={{ color: theme.muted }}>
              6 to 14 bunks, full galleys, onboard showers, CDL drivers.
            </p>
            <span
              className="mt-4 inline-block px-6 py-3 font-extrabold"
              style={{ background: theme.primary, color: theme.primaryContrast, borderRadius: theme.radiusPill }}
            >
              Request a quote
            </span>
          </div>
        </Section>
      ) : null}

      {tab === 'fonts' ? (
        <Section title="Fonts and type scale" onSave={() => void save('fonts', fonts)} onReset={() => void reset('fonts')} busy={busy}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="heading-font" className="kc-label">
                Heading font
              </label>
              <select id="heading-font" value={fonts.headingFamily} onChange={(e) => setFonts({ ...fonts, headingFamily: e.target.value })} className="kc-field">
                {FONT_CHOICES.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="body-font" className="kc-label">
                Body font
              </label>
              <select id="body-font" value={fonts.bodyFamily} onChange={(e) => setFonts({ ...fonts, bodyFamily: e.target.value })} className="kc-field">
                {FONT_CHOICES.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </div>
            <Text label="Base size (px)" type="number" value={String(fonts.baseSize)} onChange={(v) => setFonts({ ...fonts, baseSize: Number(v) || 16 })} />
            <Text label="Scale ratio" value={String(fonts.scaleRatio)} onChange={(v) => setFonts({ ...fonts, scaleRatio: Number(v) || 1.25 })} help="1.2 minor third, 1.25 major third, 1.333 perfect fourth." />
            <Text label="Body line height" value={String(fonts.lineHeight)} onChange={(v) => setFonts({ ...fonts, lineHeight: Number(v) || 1.75 })} />
            <Text label="Letter spacing" value={fonts.letterSpacing} onChange={(v) => setFonts({ ...fonts, letterSpacing: v })} />
            <Text
              label="Heading weights"
              value={fonts.headingWeights.join(', ')}
              onChange={(v) => setFonts({ ...fonts, headingWeights: v.split(',').map((n) => Number(n.trim())).filter(Boolean) })}
              help="Only these weights are fetched."
            />
            <Text
              label="Body weights"
              value={fonts.bodyWeights.join(', ')}
              onChange={(v) => setFonts({ ...fonts, bodyWeights: v.split(',').map((n) => Number(n.trim())).filter(Boolean) })}
            />
          </div>
          <p className="mt-4 rounded-control border border-line bg-surface-alt p-3 text-step--1 text-muted">
            Fonts load through next/font with <code>display: swap</code>. Changing the family here requires the font to
            be registered in <code>src/app/layout.tsx</code> — see the README section &ldquo;Changing the font&rdquo;.
          </p>
        </Section>
      ) : null}

      {tab === 'headings' ? (
        <Section title="Per-level heading styles" onSave={() => void save('headings', headings)} onReset={() => void reset('headings')} busy={busy}>
          {(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).map((level) => (
            <fieldset key={level} className="mb-5 rounded-control border border-line p-4">
              <legend className="px-1 font-extrabold uppercase">{level}</legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Text label="Size" value={headings[level].size} onChange={(v) => setHeadings({ ...headings, [level]: { ...headings[level], size: v } })} />
                <Text label="Weight" type="number" value={String(headings[level].weight)} onChange={(v) => setHeadings({ ...headings, [level]: { ...headings[level], weight: Number(v) || 700 } })} />
                <Text label="Line height" value={String(headings[level].lineHeight)} onChange={(v) => setHeadings({ ...headings, [level]: { ...headings[level], lineHeight: Number(v) || 1.2 } })} />
                <Text label="Colour" value={headings[level].color} onChange={(v) => setHeadings({ ...headings, [level]: { ...headings[level], color: v } })} />
                <Text label="Margin top" value={headings[level].marginTop} onChange={(v) => setHeadings({ ...headings, [level]: { ...headings[level], marginTop: v } })} />
                <Text label="Margin bottom" value={headings[level].marginBottom} onChange={(v) => setHeadings({ ...headings, [level]: { ...headings[level], marginBottom: v } })} />
                <div>
                  <label htmlFor={`family-${level}`} className="kc-label">
                    Family
                  </label>
                  <select
                    id={`family-${level}`}
                    value={headings[level].family}
                    onChange={(e) => setHeadings({ ...headings, [level]: { ...headings[level], family: e.target.value as 'heading' | 'body' } })}
                    className="kc-field"
                  >
                    <option value="heading">Heading font</option>
                    <option value="body">Body font</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={`transform-${level}`} className="kc-label">
                    Transform
                  </label>
                  <select
                    id={`transform-${level}`}
                    value={headings[level].transform}
                    onChange={(e) => setHeadings({ ...headings, [level]: { ...headings[level], transform: e.target.value as 'none' } })}
                    className="kc-field"
                  >
                    {['none', 'uppercase', 'lowercase', 'capitalize'].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>
          ))}
        </Section>
      ) : null}

      {tab === 'logos' ? (
        <Section title="Logos and favicon" onSave={() => void save('branding', branding)} onReset={() => void reset('branding')} busy={busy}>
          {(['headerLogo', 'stickyLogo', 'footerLogo'] as const).map((key) => (
            <fieldset key={key} className="mb-5 rounded-control border border-line p-4">
              <legend className="px-1 font-bold">{key}</legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Text label="Path" value={branding[key].src} onChange={(v) => setBranding({ ...branding, [key]: { ...branding[key], src: v } })} />
                <Text label="Alt text" value={branding[key].alt} onChange={(v) => setBranding({ ...branding, [key]: { ...branding[key], alt: v } })} />
                <Text label="Width" type="number" value={String(branding[key].width)} onChange={(v) => setBranding({ ...branding, [key]: { ...branding[key], width: Number(v) || 1 } })} />
                <Text label="Height" type="number" value={String(branding[key].height)} onChange={(v) => setBranding({ ...branding, [key]: { ...branding[key], height: Number(v) || 1 } })} />
              </div>
            </fieldset>
          ))}
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Favicon" value={branding.favicon} onChange={(v) => setBranding({ ...branding, favicon: v })} />
            <Text label="Default OG image" value={branding.defaultOgImage} onChange={(v) => setBranding({ ...branding, defaultOgImage: v })} />
          </div>
        </Section>
      ) : null}

      {tab === 'business' ? (
        <Section title="Business details" onSave={() => void save('organization', organization)} onReset={() => void reset('organization')} busy={busy}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Name" value={organization.name} onChange={(v) => setOrganization({ ...organization, name: v })} />
            <Text label="Legal name" value={organization.legalName} onChange={(v) => setOrganization({ ...organization, legalName: v })} />
            <Text label="Phone (digits)" value={organization.phone} onChange={(v) => setOrganization({ ...organization, phone: v })} help="Rendered as a real tel: link in the header, footer and contact page." />
            <Text label="Email" value={organization.email} onChange={(v) => setOrganization({ ...organization, email: v })} />
            <Text label="Street address" value={organization.streetAddress} onChange={(v) => setOrganization({ ...organization, streetAddress: v })} />
            <Text label="Locality" value={organization.addressLocality} onChange={(v) => setOrganization({ ...organization, addressLocality: v })} />
            <Text label="Region" value={organization.addressRegion} onChange={(v) => setOrganization({ ...organization, addressRegion: v })} />
            <Text label="Postal code" value={organization.postalCode} onChange={(v) => setOrganization({ ...organization, postalCode: v })} />
            <Text label="Opening hours" value={organization.openingHours} onChange={(v) => setOrganization({ ...organization, openingHours: v })} />
            <div className="sm:col-span-2">
              <Text label="Description" value={organization.description} multiline onChange={(v) => setOrganization({ ...organization, description: v })} />
            </div>
          </div>

          <h3 className="mt-6 text-step-0 font-extrabold">Social profiles</h3>
          <p className="mt-1 text-step--1 text-muted">Only profiles with a URL are rendered, and only those appear in sameAs.</p>
          {organization.sameAs.map((social, index) => (
            <div key={social.label} className="mt-3 grid gap-3 sm:grid-cols-3">
              <Text
                label="Label"
                value={social.label}
                onChange={(v) => {
                  const next = [...organization.sameAs]
                  next[index] = { ...social, label: v }
                  setOrganization({ ...organization, sameAs: next })
                }}
              />
              <Text
                label="URL"
                value={social.url}
                onChange={(v) => {
                  const next = [...organization.sameAs]
                  next[index] = { ...social, url: v }
                  setOrganization({ ...organization, sameAs: next })
                }}
              />
              <Text
                label="Icon"
                value={social.icon}
                onChange={(v) => {
                  const next = [...organization.sameAs]
                  next[index] = { ...social, icon: v }
                  setOrganization({ ...organization, sameAs: next })
                }}
              />
            </div>
          ))}
        </Section>
      ) : null}

      {tab === 'trust' ? (
        <Section title="Certifications and capabilities" onSave={() => void save('trust', trust)} onReset={() => void reset('trust')} busy={busy}>
          <p className="mb-4 rounded-control border border-line bg-surface-alt p-3 text-step--1 text-muted">
            Every certification claim on the site — EMC, DOT, FMCSA, CDL — is one of these editable records. None is
            hardcoded in a component, and none renders as a badge image without accessible text.
          </p>
          {trust.items.map((item, index) => (
            <div key={index} className="mb-3 grid gap-3 sm:grid-cols-3">
              <Text
                label="Label"
                value={item.label}
                onChange={(v) => {
                  const next = [...trust.items]
                  next[index] = { ...item, label: v }
                  setTrust({ items: next })
                }}
              />
              <Text
                label="Detail"
                value={item.detail}
                onChange={(v) => {
                  const next = [...trust.items]
                  next[index] = { ...item, detail: v }
                  setTrust({ items: next })
                }}
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <Text
                    label="Verification URL"
                    value={item.url ?? ''}
                    onChange={(v) => {
                      const next = [...trust.items]
                      next[index] = { ...item, url: v || null }
                      setTrust({ items: next })
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setTrust({ items: trust.items.filter((_, i) => i !== index) })}
                  className="mt-8 h-11 px-3 text-danger"
                  aria-label={`Remove ${item.label}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setTrust({ items: [...trust.items, { label: '', detail: '', url: null }] })}
            className="kc-btn kc-btn-outline !px-4 !py-2.5"
          >
            Add claim
          </button>
        </Section>
      ) : null}

      {tab === 'scripts' ? (
        <Section title="Injected scripts" onSave={() => void save('scripts', scripts)} onReset={() => void reset('scripts')} busy={busy}>
          {(['head', 'bodyEnd'] as const).map((slot) => (
            <fieldset key={slot} className="mb-6 rounded-control border border-line p-4">
              <legend className="px-1 font-bold">{slot === 'head' ? 'Head' : 'End of body'}</legend>
              {scripts[slot].map((script, index) => (
                <div key={index} className="mb-4 space-y-3 border-b border-line pb-4 last:border-0">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Text
                        label="Name"
                        value={script.name}
                        onChange={(v) => {
                          const next = [...scripts[slot]]
                          next[index] = { ...script, name: v }
                          setScripts({ ...scripts, [slot]: next })
                        }}
                      />
                    </div>
                    <label className="flex items-end gap-2 pb-3 text-step--1 font-semibold">
                      <input
                        type="checkbox"
                        checked={script.enabled}
                        onChange={(e) => {
                          const next = [...scripts[slot]]
                          next[index] = { ...script, enabled: e.target.checked }
                          setScripts({ ...scripts, [slot]: next })
                        }}
                        className="h-4 w-4 accent-[var(--color-primary)]"
                      />
                      Enabled
                    </label>
                    <button
                      type="button"
                      onClick={() => setScripts({ ...scripts, [slot]: scripts[slot].filter((_, i) => i !== index) })}
                      className="pb-3 text-danger"
                      aria-label={`Remove ${script.name}`}
                    >
                      ✕
                    </button>
                  </div>
                  <Text
                    label="Code"
                    value={script.code}
                    multiline
                    onChange={(v) => {
                      const next = [...scripts[slot]]
                      next[index] = { ...script, code: v }
                      setScripts({ ...scripts, [slot]: next })
                    }}
                    help="JavaScript only, without <script> tags. GA4, Search Console, Clarity."
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setScripts({ ...scripts, [slot]: [...scripts[slot], { name: '', code: '', enabled: false }] })}
                className="kc-btn kc-btn-outline !px-4 !py-2.5"
              >
                Add script
              </button>
            </fieldset>
          ))}
        </Section>
      ) : null}

      {tab === 'css' ? (
        <Section title="Global custom CSS" onSave={() => void save('customCss', customCss)} onReset={() => void reset('customCss')} busy={busy}>
          <label htmlFor="global-css" className="kc-label">
            CSS appended to every page
          </label>
          <textarea
            id="global-css"
            rows={18}
            value={customCss.global}
            onChange={(e) => setCustomCss({ global: e.target.value })}
            className="kc-field resize-y font-mono text-step--1"
          />
          <p className="mt-2 text-step--1 text-subtle">Per-page CSS lives in the page builder, under Page settings.</p>
        </Section>
      ) : null}
    </div>
  )
}

function Section({
  title,
  children,
  onSave,
  onReset,
  busy,
}: {
  title: string
  children: React.ReactNode
  onSave: () => void
  onReset: () => void
  busy: boolean
}) {
  return (
    <section className="rounded-card border border-line bg-surface p-6">
      <h2 className="mb-5 text-step-1">{title}</h2>
      {children}
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={onSave} disabled={busy} className="kc-btn kc-btn-primary !px-5 !py-2.5">
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onReset} disabled={busy} className="kc-btn kc-btn-outline !px-5 !py-2.5">
          Reset to defaults
        </button>
      </div>
    </section>
  )
}
