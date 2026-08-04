import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { AnyBlockProps, ctaSchema, imageSchema } from '@/lib/blocks/schema'
import type { z } from 'zod'

type Cta = z.infer<typeof ctaSchema>
type Img = z.infer<typeof imageSchema>

/** Background/spacing tokens shared by every block. */
type Base = Pick<AnyBlockProps, 'background' | 'spacing' | 'align' | 'anchor' | 'className'>

const BACKGROUNDS: Record<Base['background'], string> = {
  surface: 'bg-surface text-ink',
  alt: 'bg-surface-alt text-ink border-y border-line',
  dark: 'bg-surface-dark text-on-dark',
  primary: 'bg-primary text-primary-contrast',
  none: '',
}

const SPACING: Record<Base['spacing'], string> = {
  none: 'py-0',
  sm: 'py-10 md:py-14',
  md: 'py-section',
  lg: 'py-section-lg',
}

/**
 * Every block renders as a real <section> landmark with its own background and
 * spacing tokens. No <div> stands in where a landmark element exists.
 */
export function Section({
  base,
  children,
  as: Tag = 'section',
  labelledBy,
  containerClassName,
  bare = false,
}: {
  base: Base
  children: ReactNode
  as?: 'section' | 'aside' | 'article'
  labelledBy?: string
  containerClassName?: string
  bare?: boolean
}) {
  return (
    <Tag
      id={base.anchor || undefined}
      aria-labelledby={labelledBy}
      className={cn(
        'relative',
        BACKGROUNDS[base.background],
        SPACING[base.spacing],
        base.align === 'center' && 'text-center',
        base.className,
      )}
    >
      {bare ? children : <div className={cn('kc-container', containerClassName)}>{children}</div>}
    </Tag>
  )
}

export function Eyebrow({
  children,
  rules = 'left',
  className,
}: {
  children: ReactNode
  rules?: 'left' | 'both'
  className?: string
}) {
  if (!children) return null
  return (
    <p data-rules={rules} className={cn('kc-eyebrow mb-4', className)}>
      <span>{children}</span>
    </p>
  )
}

/**
 * Section heading. `level` is explicit rather than inferred so a page can
 * guarantee exactly one <h1> and no skipped levels.
 */
export function SectionHeading({
  id,
  eyebrow,
  heading,
  level = 'h2',
  subheading,
  body,
  align = 'left',
  onDark = false,
  className,
}: {
  id?: string
  eyebrow?: string
  heading?: string
  level?: 'h1' | 'h2' | 'h3'
  subheading?: string
  body?: string
  align?: 'left' | 'center'
  onDark?: boolean
  className?: string
}) {
  if (!eyebrow && !heading && !subheading && !body) return null
  const H = level
  return (
    <div className={cn(align === 'center' && 'mx-auto max-w-[46rem] text-center', className)}>
      {eyebrow ? <Eyebrow rules={align === 'center' ? 'both' : 'left'}>{eyebrow}</Eyebrow> : null}
      {heading ? (
        <H id={id} className={onDark ? 'text-on-dark' : undefined}>
          {heading}
        </H>
      ) : null}
      {subheading ? (
        <p className={cn('mt-3 text-step-1 font-semibold', onDark ? 'text-on-dark-muted' : 'text-ink')}>
          {subheading}
        </p>
      ) : null}
      {body ? (
        <p className={cn('mt-4 text-step-0 leading-relaxed', onDark ? 'text-on-dark-muted' : 'text-muted')}>
          {body}
        </p>
      ) : null}
    </div>
  )
}

/** Internal links use next/link; external and tel:/mailto: fall through to <a>. */
export function SmartLink({
  href,
  children,
  className,
  ...rest
}: {
  href: string
  children: ReactNode
  className?: string
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const isInternal = href.startsWith('/') && !href.startsWith('//')
  if (isInternal) {
    return (
      <Link href={href} className={className} {...rest}>
        {children}
      </Link>
    )
  }
  const external = /^https?:\/\//i.test(href)
  return (
    <a
      href={href}
      className={className}
      {...(external ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
      {...rest}
    >
      {children}
    </a>
  )
}

const CTA_STYLES: Record<Cta['style'], string> = {
  primary: 'kc-btn kc-btn-primary',
  outline: 'kc-btn kc-btn-outline',
  ghost: 'kc-btn kc-btn-ghost-dark',
}

export function CtaButton({ cta, className }: { cta: Cta; className?: string }) {
  if (!cta.label || !cta.url) return null
  return (
    <SmartLink href={cta.url} className={cn(CTA_STYLES[cta.style], className)}>
      {cta.label}
    </SmartLink>
  )
}

export function CtaRow({ ctas, className }: { ctas: Cta[]; className?: string }) {
  const usable = ctas.filter((c) => c.label && c.url)
  if (!usable.length) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-4', className)}>
      {usable.map((cta, i) => (
        <CtaButton key={`${cta.url}-${i}`} cta={cta} />
      ))}
    </div>
  )
}

/**
 * next/image with width and height always supplied, so CLS stays at zero.
 * An image with neither alt text nor an explicit decorative flag does not
 * render — that state is a content bug and is surfaced in the admin SEO audit
 * rather than shipped as an unlabelled image.
 */
export function SmartImage({
  image,
  className,
  sizes,
  priority = false,
  fill = false,
}: {
  image: Img
  className?: string
  sizes?: string
  priority?: boolean
  fill?: boolean
}) {
  if (!image.src) return null
  if (!image.alt && !image.decorative) return null

  // `alt` is passed explicitly rather than spread so it is statically visible to
  // the jsx-a11y lint rule and to anyone reading this.
  const alt = image.decorative ? '' : image.alt
  const common = {
    src: image.src,
    className,
    sizes,
    priority,
    ...(image.decorative ? { 'aria-hidden': true as const } : {}),
  }

  if (fill) return <Image {...common} alt={alt} fill />
  return <Image {...common} alt={alt} width={image.width} height={image.height} />
}

/** Image plus the fact it carries. Captions are content, not decoration. */
export function Figure({
  image,
  className,
  imageClassName,
  sizes,
  priority,
}: {
  image: Img
  className?: string
  imageClassName?: string
  sizes?: string
  priority?: boolean
}) {
  if (!image.src) return null
  return (
    <figure className={className}>
      <SmartImage image={image} className={imageClassName} sizes={sizes} priority={priority} />
      {image.caption ? (
        <figcaption className="mt-3 text-step--1 text-subtle">{image.caption}</figcaption>
      ) : null}
    </figure>
  )
}

/** Card shell used across service, feature, coach and destination grids. */
export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'article' | 'li'
}) {
  return (
    <Tag
      className={cn(
        'rounded-card border border-line bg-surface shadow-card transition duration-300',
        'hover:-translate-y-1.5 hover:shadow-card-hover',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

const COLUMN_CLASSES: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

export function Grid({
  columns,
  children,
  className,
  as: Tag = 'div',
}: {
  columns: number
  children: ReactNode
  className?: string
  as?: 'div' | 'ul'
}) {
  return (
    <Tag className={cn('grid grid-cols-1 gap-5', COLUMN_CLASSES[columns] ?? COLUMN_CLASSES[3], className)}>
      {children}
    </Tag>
  )
}
