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

async function loadAll(): Promise<SettingsMap> {
  const out: SettingsMap = structuredClone(DEFAULTS)
  try {
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
  } catch {
    // A settings read must never take the site down; defaults reproduce the
    // shipped design exactly.
  }
  return out
}

export const getSettings = unstable_cache(loadAll, ['settings'], {
  tags: ['settings'],
  revalidate: 3600,
})

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingsMap[K]> {
  const all = await getSettings()
  return all[key]
}
