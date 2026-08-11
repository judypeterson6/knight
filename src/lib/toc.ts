import { slugify } from '@/lib/utils'

export interface TocItem {
  id: string
  text: string
  level: 2 | 3
}

/**
 * Adds anchor ids to the headings in a body of HTML and returns a table of
 * contents built from them.
 *
 * The migrated WordPress bodies carry <h2> and <h3> elements with no id, so
 * there is nothing for a contents list to link to. Rather than asking an editor
 * to hand-write anchors, the id is derived from the heading text at render
 * time, which means the contents list can never drift out of step with the
 * article: both are produced from the same pass.
 *
 * Duplicate headings get a numeric suffix, because two anchors sharing an id is
 * invalid HTML and the browser would only ever reach the first.
 *
 * An id already present in the source is left alone, so an editor can pin a
 * stable anchor for an external link and this will not overwrite it.
 */
export function withHeadingAnchors(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = []
  const used = new Set<string>()

  const out = html.replace(
    /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (match, levelRaw: string, attrs: string, inner: string) => {
      const level = Number(levelRaw) as 2 | 3
      const text = inner
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim()

      if (!text) return match

      const existing = /\sid=["']([^"']+)["']/i.exec(attrs)
      let id = existing?.[1] ?? slugify(text)
      if (!id) return match

      if (!existing) {
        let suffix = 2
        const base = id
        while (used.has(id)) {
          id = `${base}-${suffix}`
          suffix += 1
        }
      }
      used.add(id)
      toc.push({ id, text, level })

      const cleaned = existing ? attrs : `${attrs} id="${id}"`
      return `<h${level}${cleaned}>${inner}</h${level}>`
    },
  )

  return { html: out, toc }
}
