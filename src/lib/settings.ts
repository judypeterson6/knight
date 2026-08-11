import 'server-only'
import { unstable_cache } from 'next/cache'
import type { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { DEFAULTS, SCHEMAS, type SettingKey, type SettingsMap } from '@/lib/settings-defaults'

/**
 * Server-side settings reader.
 *
 * The schemas, types and defaults live in ./settings-defaults, which carries no
 * `server-only` marker — prisma/seed.ts imports them under plain tsx, where the
 * `server-only` package does not resolve. Everything is re-exported here so
 * existing `@/lib/settings` imports keep working.
 */

export * from '@/lib/settings-defaults'

export function schemaFor(key: SettingKey): z.ZodTypeAny {
  return SCHEMAS[key]
}

/**
 * Reads every settings group, or throws.
 *
 * Deliberately lets a database failure propagate. This used to swallow it and
 * return DEFAULTS, which looked harmless because the defaults reproduce the
 * shipped design. It was not: the result went through unstable_cache, so one
 * failed read pinned the defaults in place for the next hour. A transient
 * outage at the wrong moment silently reverted the theme, the SEO settings and
 * the SMTP credentials, which took outbound mail down site-wide long after the
 * database recovered.
 */
async function loadAll(): Promise<SettingsMap> {
  const out: SettingsMap = structuredClone(DEFAULTS)
  const rows = await prisma.setting.findMany()

  for (const row of rows) {
    if (!(row.key in SCHEMAS)) continue
    const key = row.key as SettingKey
    // Merge over defaults so a partially-populated row never drops a token.
    const merged = { ...(DEFAULTS[key] as object), ...(row.value as object) }
    const parsed = SCHEMAS[key].safeParse(merged)
    if (parsed.success) {
      // Key and value are correlated by construction; TypeScript cannot track
      // that through a union-keyed assignment.
      ;(out as unknown as Record<string, unknown>)[key] = parsed.data
    }
  }
  return out
}

const loadAllCached = unstable_cache(loadAll, ['settings'], {
  tags: ['settings'],
  revalidate: 3600,
})

/**
 * Settings for the current request.
 *
 * A successful read is cached under the `settings` tag and invalidated on save.
 * A failed one falls back to the shipped defaults so the site still renders,
 * but that fallback happens here rather than inside the cached function, so it
 * is never stored: the next request tries the database again.
 */
export async function getSettings(): Promise<SettingsMap> {
  try {
    return await loadAllCached()
  } catch {
    return structuredClone(DEFAULTS)
  }
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingsMap[K]> {
  const all = await getSettings()
  return all[key]
}
