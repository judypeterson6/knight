import type { Prisma } from '@prisma/client'

/**
 * What counts as publicly visible.
 *
 * A `SCHEDULED` row whose `publishedAt` has passed is live. Without this, the
 * SCHEDULED status the admin offers would be a trap: an editor sets a future
 * date, the date passes, and the post never appears because every public query
 * filtered on `status: 'PUBLISHED'` alone.
 *
 * Keeping the status column untouched (rather than flipping it on a timer) means
 * this needs no cron and no background job — the row becomes visible the moment
 * its date passes. The one consequence is that the status shown in the admin
 * stays `SCHEDULED`; `isLive()` is what the admin UI uses to say "live now".
 *
 * ISR caveat: public routes revalidate every 300s, so a scheduled item appears
 * within five minutes of its time rather than to the second. Publish immediately
 * instead if you need exact timing.
 */

/** Visible-now filter for any model with `status` + `publishedAt`. */
export function publishedWhere(now: Date = new Date()) {
  return {
    OR: [
      { status: 'PUBLISHED' as const },
      { status: 'SCHEDULED' as const, publishedAt: { lte: now } },
    ],
  }
}

export const publishedPageWhere = (now?: Date): Prisma.PageWhereInput => publishedWhere(now)
export const publishedPostWhere = (now?: Date): Prisma.PostWhereInput => publishedWhere(now)
export const publishedCoachWhere = (now?: Date): Prisma.CoachWhereInput => publishedWhere(now)
export const publishedLocationWhere = (now?: Date): Prisma.LocationWhereInput => publishedWhere(now)
export const publishedTestimonialWhere = (now?: Date): Prisma.TestimonialWhereInput => publishedWhere(now)

/** Whether a single already-loaded row should be shown to the public. */
export function isLive(
  row: { status: string; publishedAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (row.status === 'PUBLISHED') return true
  if (row.status === 'SCHEDULED') return Boolean(row.publishedAt && row.publishedAt <= now)
  return false
}

/** Admin label for a row's real visibility, which SCHEDULED alone does not convey. */
export function publishState(row: { status: string; publishedAt: Date | null }): 'Live' | 'Scheduled' | 'Draft' | 'Archived' {
  if (row.status === 'ARCHIVED') return 'Archived'
  if (isLive(row)) return 'Live'
  if (row.status === 'SCHEDULED') return 'Scheduled'
  return 'Draft'
}
