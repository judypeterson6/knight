import 'server-only'
import { revalidatePath, revalidateTag } from 'next/cache'
import { notifySearchEngines } from '@/lib/indexing'
import type { IndexingAction } from '@prisma/client'

/**
 * Cache invalidation on save.
 *
 * Public pages are ISR with tags; nothing uses force-dynamic. Every mutation
 * calls one of these, which busts the relevant tag, revalidates the path, and
 * (fire-and-forget) tells the search engines the URL changed.
 */

export async function revalidatePageRoute(route: string, action: IndexingAction = 'URL_UPDATED'): Promise<void> {
  revalidateTag('pages')
  revalidateTag(`page:${route}`)
  revalidatePath(route)
  void notifySearchEngines([route], action).catch(() => undefined)
}

export async function revalidatePost(slug: string, action: IndexingAction = 'URL_UPDATED'): Promise<void> {
  const route = `/blog/${slug}`
  revalidatePath(route)
  revalidatePath('/blog')
  void notifySearchEngines([route], action).catch(() => undefined)
}

export async function revalidateCoach(slug: string, action: IndexingAction = 'URL_UPDATED'): Promise<void> {
  const route = `/fleet/${slug}`
  revalidatePath(route)
  revalidatePath('/fleet')
  void notifySearchEngines([route], action).catch(() => undefined)
}

export function revalidateSettings(): void {
  revalidateTag('settings')
  revalidatePath('/', 'layout')
}

export function revalidateMenus(): void {
  revalidateTag('menus')
  revalidatePath('/', 'layout')
}

export function revalidateForms(slug?: string): void {
  revalidateTag('forms')
  if (slug) revalidateTag(`form:${slug}`)
}

export function revalidateRedirects(): void {
  revalidateTag('redirects')
}

/** Structured content (coaches, FAQs, testimonials, locations) appears on many
 *  pages at once, so a change there invalidates the whole page cache. */
export function revalidateStructuredContent(): void {
  revalidateTag('pages')
  revalidatePath('/', 'layout')
}
