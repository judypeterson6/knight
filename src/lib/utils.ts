import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** All routes in this app are leading-slash, no trailing slash. Home is '/'. */
export function normalizeRoute(input: string): string {
  const clean = input.split('#')[0].split('?')[0].trim()
  if (!clean || clean === '/') return '/'
  const withSlash = clean.startsWith('/') ? clean : `/${clean}`
  return withSlash.replace(/\/+$/, '') || '/'
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 190)
}

/**
 * The site's canonical origin: https, no www, no trailing slash.
 *
 * Normalised here rather than trusted from the environment, because this one
 * string is the base for every canonical tag, OG URL, sitemap entry and
 * JSON-LD @id. A stray `www.` or `http://` in the variable would otherwise
 * publish a origin that disagrees with what the middleware redirects to, and
 * every one of those URLs would point at a 301 instead of the real page.
 *
 * localhost keeps its scheme and port so development works normally.
 */
export function siteOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').trim()
  try {
    const url = new URL(raw)
    const host = url.host.toLowerCase()
    if (host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]')) {
      return `${url.protocol}//${host}`
    }
    return `https://${host.replace(/^www\./, '')}`
  } catch {
    return 'http://localhost:3000'
  }
}

export function absoluteUrl(routePath: string): string {
  const base = siteOrigin()
  return routePath === '/' ? base : `${base}${normalizeRoute(routePath)}`
}

/** '8557345700' -> '855 734 5700' for display; tel: hrefs use the raw digits. */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  if (digits.length !== 10) return raw
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
}

export function telHref(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return `tel:${digits.length === 10 ? `+1${digits}` : `+${digits}`}`
}

export function formatDate(value: Date | string, locale = 'en-US'): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
}

export function isoDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toISOString()
}

export function excerptFrom(html: string, max = 180): string {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;/g, '’')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, text.lastIndexOf(' ', max))}…`
}

export function readingMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 225))
}

/** Strips anything that could execute when migrated WordPress HTML is rendered. */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe(?![^>]*\bsrc\s*=\s*["']\/)[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}
