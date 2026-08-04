/** Emits a prepared JSON-LD @graph. Renders nothing when there is no graph. */
export function JsonLd({ data }: { data: string | null }) {
  if (!data) return null
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: data }} />
}
