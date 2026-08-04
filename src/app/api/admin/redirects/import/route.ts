import { prisma } from '@/lib/prisma'
import { guard, ok, parseBody } from '@/lib/api'
import { redirectImportSchema } from '@/lib/admin-schemas'
import { revalidateRedirects } from '@/lib/revalidate'
import { normalizeRoute } from '@/lib/utils'

export const runtime = 'nodejs'

/** CSV export of the redirect table. */
export async function GET(): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const rows = await prisma.redirect.findMany({ orderBy: { from: 'asc' } })
  const escape = (value: string): string => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

  const csv = [
    'from,to,kind,enabled,hits,note',
    ...rows.map((r) =>
      [r.from, r.to, r.kind, String(r.enabled), String(r.hits), r.note ?? ''].map(escape).join(','),
    ),
  ].join('\n')

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="knightscoaches-redirects.csv"',
    },
  })
}

/**
 * CSV import. Accepts `from,to[,kind]` with an optional header row. Existing
 * sources are updated rather than duplicated.
 */
export async function POST(request: Request): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const body = await parseBody(request, redirectImportSchema)
  if (!body.ok) return body.response

  const lines = body.data.csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  let imported = 0
  const skipped: string[] = []

  for (const [index, line] of lines.entries()) {
    const cells = splitCsvLine(line)
    if (index === 0 && /^from$/i.test(cells[0] ?? '')) continue

    const from = normalizeRoute(cells[0] ?? '')
    const to = (cells[1] ?? '').trim()
    const kind = (cells[2] ?? 'PERMANENT').trim().toUpperCase() === 'TEMPORARY' ? 'TEMPORARY' : 'PERMANENT'

    if (!from || from === '/' || !to) {
      skipped.push(line)
      continue
    }
    if (from === normalizeRoute(to)) {
      // A redirect to itself is a loop, not a redirect.
      skipped.push(`${line} (source and target are the same)`)
      continue
    }

    await prisma.redirect.upsert({
      where: { from },
      create: { from, to, kind, note: 'Imported from CSV', enabled: true },
      update: { to, kind },
    })
    imported += 1
  }

  revalidateRedirects()
  return ok({ imported, skipped })
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells.map((c) => c.trim())
}
