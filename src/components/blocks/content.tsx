import { cn, sanitizeHtml } from '@/lib/utils'
import type { BlockPropsMap } from '@/lib/blocks/schema'
import { CtaRow, Figure, Section, SectionHeading, SmartImage } from '@/components/ui/primitives'

/**
 * RichText — the workhorse for migrated WordPress body copy. Heading levels,
 * lists and section order all survive the migration and render here verbatim
 * (sanitised), optionally paired with an image.
 */
export function RichTextBlock({ props }: { props: BlockPropsMap['RichText'] }) {
  const headingId = props.anchor ? `${props.anchor}-heading` : undefined
  const hasImage = props.imagePosition !== 'none' && props.image.src

  const text = (
    <div className={cn(props.maxWidth === 'prose' && !hasImage && 'mx-auto max-w-prose')}>
      <SectionHeading
        id={headingId}
        eyebrow={props.eyebrow}
        heading={props.heading}
        level={props.headingLevel}
        subheading={props.subheading}
        onDark={props.background === 'dark'}
      />
      {props.heading ? <div aria-hidden className="mt-5 h-[3px] w-14 rounded bg-primary" /> : null}
      {props.body ? (
        <p
          className={cn(
            'mt-6 text-[1.03rem] leading-[1.85]',
            props.background === 'dark' ? 'text-on-dark-muted' : 'text-muted',
          )}
        >
          {props.body}
        </p>
      ) : null}
      {props.html ? (
        <div
          className={cn('kc-prose mt-6', props.background === 'dark' && 'text-on-dark-muted')}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(props.html) }}
        />
      ) : null}
      <CtaRow ctas={props.ctas} className="mt-8" />
    </div>
  )

  return (
    <Section base={props} labelledBy={headingId}>
      {hasImage ? (
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Figure
            image={props.image}
            className={cn(props.imagePosition === 'left' ? 'lg:order-first' : 'lg:order-last')}
            imageClassName="w-full rounded-block object-cover shadow-card"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          {text}
        </div>
      ) : (
        text
      )}
    </Section>
  )
}

/**
 * Gallery. Every image carries a <figcaption> stating the fact it shows, so the
 * information is not trapped in pixels.
 */
export function GalleryBlock({ props }: { props: BlockPropsMap['Gallery'] }) {
  const usable = props.items.filter((image) => image.src && (image.alt || image.decorative))
  if (!usable.length) return null
  const headingId = props.anchor ? `${props.anchor}-heading` : undefined

  return (
    <Section base={props} labelledBy={headingId}>
      <SectionHeading
        id={headingId}
        eyebrow={props.eyebrow}
        heading={props.heading}
        level={props.headingLevel}
        body={props.body}
        align={props.align}
        className="mb-10"
      />
      <ul
        className={cn(
          'grid grid-cols-1 gap-5 sm:grid-cols-2',
          props.columns === 3 && 'lg:grid-cols-3',
          props.columns === 4 && 'lg:grid-cols-4',
        )}
      >
        {usable.map((image, i) => (
          <li key={`${image.src}-${i}`}>
            <figure className="overflow-hidden rounded-card border border-line bg-surface">
              <SmartImage
                image={image}
                className="aspect-[4/3] w-full object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              {image.caption ? (
                <figcaption className="px-5 py-4 text-step--1 text-muted">{image.caption}</figcaption>
              ) : null}
            </figure>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/**
 * RawHtml — the escape hatch for embeds the block library does not cover.
 * Content is sanitised: inline event handlers, <script>, and javascript: URLs
 * are stripped before render.
 */
export function RawHtmlBlock({ props }: { props: BlockPropsMap['RawHtml'] }) {
  if (!props.html) return null
  const headingId = props.anchor ? `${props.anchor}-heading` : undefined
  return (
    <Section base={props} labelledBy={headingId}>
      {props.heading ? (
        <h2 id={headingId} className="mb-6">
          {props.heading}
        </h2>
      ) : null}
      <div className="kc-prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(props.html) }} />
    </Section>
  )
}
