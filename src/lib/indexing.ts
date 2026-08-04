import 'server-only'
import { GoogleAuth } from 'google-auth-library'
import { prisma } from '@/lib/prisma'
import { absoluteUrl } from '@/lib/utils'
import type { IndexingAction } from '@prisma/client'

/**
 * Search-engine submission.
 *
 * IndexNow is the primary channel here and works today: the key file is served
 * from /<key>.txt by the middleware and changed URLs are POSTed on publish.
 *
 * The Google Indexing API is wired up because it was asked for, but note the
 * limitation, which is also stated in the README: Google officially restricts
 * that API to JobPosting and BroadcastEvent pages. Calls for a service or fleet
 * URL will usually be accepted and then ignored. The sitemap plus Search
 * Console remains the real path to indexation for this site.
 */

const DAILY_QUOTA = { INDEXNOW: 10_000, GOOGLE: 200, SITEMAP_PING: 1_000 } as const

export async function quotaUsedToday(provider: keyof typeof DAILY_QUOTA): Promise<number> {
  const since = new Date()
  since.setHours(0, 0, 0, 0)
  try {
    return await prisma.indexingLog.count({ where: { provider, createdAt: { gte: since } } })
  } catch {
    return 0
  }
}

export function quotaFor(provider: keyof typeof DAILY_QUOTA): number {
  return DAILY_QUOTA[provider]
}

async function log(
  url: string,
  provider: keyof typeof DAILY_QUOTA,
  action: IndexingAction,
  status: 'SUCCESS' | 'FAILED',
  code: number | null,
  response: string | null,
): Promise<void> {
  await prisma.indexingLog
    .create({ data: { url, provider, action, status, code, response: response?.slice(0, 4000) ?? null } })
    .catch(() => undefined)
}

/** POSTs a batch of changed URLs to IndexNow. Max 10,000 per call. */
export async function submitToIndexNow(paths: string[], action: IndexingAction = 'URL_UPDATED'): Promise<{ ok: boolean; message: string }> {
  const key = process.env.INDEXNOW_KEY
  if (!key) return { ok: false, message: 'INDEXNOW_KEY is not set' }
  if (!paths.length) return { ok: false, message: 'No URLs supplied' }

  const urls = paths.map((p) => (p.startsWith('http') ? p : absoluteUrl(p)))
  const host = new URL(absoluteUrl('/')).host

  try {
    const res = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: absoluteUrl(`/${key}.txt`), urlList: urls.slice(0, 10_000) }),
    })
    const text = await res.text()
    const status = res.ok ? 'SUCCESS' : 'FAILED'
    await Promise.all(urls.map((url) => log(url, 'INDEXNOW', action, status, res.status, text)))
    return { ok: res.ok, message: res.ok ? `Submitted ${urls.length} URL(s)` : `IndexNow returned ${res.status}` }
  } catch (error) {
    const message = (error as Error).message
    await Promise.all(urls.map((url) => log(url, 'INDEXNOW', action, 'FAILED', null, message)))
    return { ok: false, message }
  }
}

/**
 * Google Indexing API. Requires a service-account JSON in
 * GOOGLE_INDEXING_SA_JSON with the Indexer role on the property.
 */
export async function submitToGoogle(paths: string[], action: IndexingAction = 'URL_UPDATED'): Promise<{ ok: boolean; message: string }> {
  const raw = process.env.GOOGLE_INDEXING_SA_JSON
  if (!raw) return { ok: false, message: 'GOOGLE_INDEXING_SA_JSON is not set' }

  let credentials: Record<string, unknown>
  try {
    credentials = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return { ok: false, message: 'GOOGLE_INDEXING_SA_JSON is not valid JSON' }
  }

  const used = await quotaUsedToday('GOOGLE')
  if (used >= DAILY_QUOTA.GOOGLE) {
    return { ok: false, message: `Daily Google quota reached (${used}/${DAILY_QUOTA.GOOGLE})` }
  }

  try {
    const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/indexing'] })
    const client = await auth.getClient()
    const urls = paths.map((p) => (p.startsWith('http') ? p : absoluteUrl(p)))

    let failures = 0
    for (const url of urls) {
      try {
        const res = await client.request({
          url: 'https://indexing.googleapis.com/v3/urlNotifications:publish',
          method: 'POST',
          data: { url, type: action },
        })
        await log(url, 'GOOGLE', action, 'SUCCESS', res.status ?? 200, JSON.stringify(res.data))
      } catch (error) {
        failures += 1
        await log(url, 'GOOGLE', action, 'FAILED', null, (error as Error).message)
      }
    }
    return {
      ok: failures === 0,
      message: failures === 0 ? `Submitted ${urls.length} URL(s)` : `${failures} of ${urls.length} failed`,
    }
  } catch (error) {
    return { ok: false, message: (error as Error).message }
  }
}

/** Pings the search engines that still honour sitemap pings. */
export async function pingSitemap(): Promise<{ ok: boolean; message: string }> {
  const sitemap = absoluteUrl('/sitemap.xml')
  const endpoints = [`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemap)}`]

  let ok = true
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { method: 'GET' })
      await log(sitemap, 'SITEMAP_PING', 'URL_UPDATED', res.ok ? 'SUCCESS' : 'FAILED', res.status, endpoint)
      if (!res.ok) ok = false
    } catch (error) {
      ok = false
      await log(sitemap, 'SITEMAP_PING', 'URL_UPDATED', 'FAILED', null, (error as Error).message)
    }
  }
  return { ok, message: ok ? 'Sitemap ping sent' : 'One or more pings failed' }
}

/** Called after any publish/update/delete. Failures never block the save. */
export async function notifySearchEngines(paths: string[], action: IndexingAction = 'URL_UPDATED'): Promise<void> {
  if (!paths.length) return
  await Promise.allSettled([
    process.env.INDEXNOW_KEY ? submitToIndexNow(paths, action) : Promise.resolve(),
    process.env.GOOGLE_INDEXING_SA_JSON ? submitToGoogle(paths, action) : Promise.resolve(),
    pingSitemap(),
  ])
}

/** Re-runs every failed row for a URL. */
export async function retryFailed(ids: string[]): Promise<{ retried: number }> {
  const rows = await prisma.indexingLog.findMany({ where: { id: { in: ids }, status: 'FAILED' } }).catch(() => [])
  for (const row of rows) {
    const result =
      row.provider === 'INDEXNOW'
        ? await submitToIndexNow([row.url], row.action)
        : row.provider === 'GOOGLE'
          ? await submitToGoogle([row.url], row.action)
          : await pingSitemap()
    await prisma.indexingLog
      .update({
        where: { id: row.id },
        data: { attempts: { increment: 1 }, status: result.ok ? 'SUCCESS' : 'FAILED', response: result.message },
      })
      .catch(() => undefined)
  }
  return { retried: rows.length }
}
