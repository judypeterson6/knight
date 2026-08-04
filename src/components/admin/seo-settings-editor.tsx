'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SeoSettings } from '@/lib/settings'
import { Text } from '@/components/admin/props-inspector'

export function SeoSettingsEditor({ initial }: { initial: SeoSettings }) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setMessage('Saving…')
    const res = await fetch('/api/admin/settings/seo', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: form }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }
    setBusy(false)
    setMessage(body.ok ? 'Saved.' : (body.error ?? 'Save failed.'))
    if (body.ok) router.refresh()
  }

  return (
    <section className="space-y-5 rounded-card border border-line bg-surface p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Site name" value={form.siteName} onChange={(v) => setForm({ ...form, siteName: v })} />
        <Text
          label="Title template"
          value={form.titleTemplate}
          onChange={(v) => setForm({ ...form, titleTemplate: v })}
          help="%page% and %site% are substituted. A page with its own meta title overrides the template entirely."
        />
        <div className="sm:col-span-2">
          <Text
            label="Default meta description"
            value={form.defaultDescription}
            multiline
            onChange={(v) => setForm({ ...form, defaultDescription: v })}
            help={`${form.defaultDescription.length} characters. Used when a URL has no description of its own.`}
          />
        </div>
        <Text label="Default OG image" value={form.defaultOgImage} onChange={(v) => setForm({ ...form, defaultOgImage: v })} />
        <Text label="Twitter card type" value={form.twitterCard} onChange={(v) => setForm({ ...form, twitterCard: v })} />
        <Text label="Twitter handle" value={form.twitterSite} onChange={(v) => setForm({ ...form, twitterSite: v })} />
        <Text label="Google verification code" value={form.googleVerification} onChange={(v) => setForm({ ...form, googleVerification: v })} />
        <Text label="Bing verification code" value={form.bingVerification} onChange={(v) => setForm({ ...form, bingVerification: v })} />
      </div>

      <div>
        <label htmlFor="robots-txt" className="kc-label">
          robots.txt
        </label>
        <textarea
          id="robots-txt"
          rows={10}
          value={form.robotsTxt}
          onChange={(e) => setForm({ ...form, robotsTxt: e.target.value })}
          placeholder={'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: https://knightscoaches.com/sitemap.xml'}
          className="kc-field resize-y font-mono text-step--1"
        />
        <p className="mt-1.5 text-step--1 text-subtle">
          Leave blank to serve the default, which always points at the sitemap index and disallows /admin and /api.
        </p>
      </div>

      <p role="status" aria-live="polite" className={message ? 'text-step--1 text-muted' : 'sr-only'}>
        {message}
      </p>

      <button type="button" onClick={() => void save()} disabled={busy} className="kc-btn kc-btn-primary !px-5 !py-2.5">
        {busy ? 'Saving…' : 'Save SEO settings'}
      </button>
    </section>
  )
}
