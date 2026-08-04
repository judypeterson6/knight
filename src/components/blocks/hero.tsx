import Image from 'next/image'
import { getSettings } from '@/lib/settings'
import { getForm } from '@/lib/forms'
import { cn, formatPhone, telHref } from '@/lib/utils'
import type { BlockPropsMap } from '@/lib/blocks/schema'
import { CtaButton, CtaRow, Section, SectionHeading, SmartLink } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/icon'
import { QuoteFormClient } from '@/components/forms/quote-form-client'

/**
 * Hero.
 *
 * `variant: 'landing'` is the homepage / service-page centerpiece. It follows
 * the ranking spec above the fold:
 *   1. <h1> — entity + service + coverage
 *   2. the service statement
 *   3. THE ACTION BLOCK — an inline quote form, plus the phone number as a real
 *      <a href="tel:"> with the digits as text
 *   4. the trust strip
 *
 * The CTA is the form itself, not a button that scrolls to content further down
 * the page. Nothing renders above the <h1> inside <main>.
 *
 * `variant: 'page'` is the inner-page banner used by /about-us, /fleet and the
 * location and audience pages.
 */
export async function HeroBlock({ props, first }: { props: BlockPropsMap['Hero']; first: boolean }) {
  const { organization } = await getSettings()
  const phone = organization.phone
  const isLanding = props.variant === 'landing'
  const headingId = props.anchor ? `${props.anchor}-heading` : 'hero-heading'
  const H = props.headingLevel

  const form = props.showQuoteForm ? await getForm(props.quoteFormSlug) : null

  return (
    <Section base={{ ...props, background: 'none', spacing: 'none' }} bare labelledBy={headingId}>
      <div
        className={cn(
          'relative isolate overflow-hidden bg-surface-dark',
          isLanding ? 'min-h-[min(100svh,54rem)]' : 'min-h-[26rem]',
        )}
      >
        {/* Background media. Decorative — every fact it carries is also text below. */}
        {props.videoSrc ? (
          <video
            className="absolute inset-0 -z-10 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            poster={props.image.src || undefined}
            aria-hidden
          >
            <source src={props.videoSrc} type="video/mp4" />
          </video>
        ) : props.image.src ? (
          <Image
            src={props.image.src}
            alt=""
            aria-hidden
            fill
            priority={first}
            sizes="100vw"
            className="absolute inset-0 -z-10 object-cover"
          />
        ) : null}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(10_8_6/0.9),rgb(10_8_6/0.68)_45%,rgb(10_8_6/0.35))]"
        />

        <div
          className={cn(
            'kc-container relative flex flex-col justify-center',
            isLanding ? 'py-28 md:py-32 lg:py-36' : 'pb-16 pt-32 md:pb-20 md:pt-40',
          )}
        >
          <div className={cn('grid gap-10', isLanding && form ? 'lg:grid-cols-[1.1fr_minmax(0,26rem)]' : '')}>
            <div className="max-w-3xl">
              {props.eyebrow ? (
                <p className="mb-6 inline-flex items-center gap-3 rounded-pill border border-primary/50 bg-primary/15 px-4 py-2 text-[0.78rem] font-bold uppercase tracking-[0.18em] text-accent">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-primary" />
                  {props.eyebrow}
                </p>
              ) : null}

              <H id={headingId} className="text-on-dark">
                {props.heading}
              </H>

              {props.subheading ? (
                <p className="mt-4 text-step-1 font-semibold text-accent">{props.subheading}</p>
              ) : null}

              {/* The service statement: what is provided, on what equipment, over what area. */}
              {props.body ? (
                <p className="mt-6 max-w-2xl text-[1.03rem] leading-relaxed text-on-dark-muted">{props.body}</p>
              ) : null}

              {/* Action block — highest-contrast element. Phone is real text in a tel: link. */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <CtaRow ctas={props.ctas} />
                <a
                  href={telHref(phone)}
                  className="inline-flex items-center gap-3 rounded-pill border border-white/35 px-6 py-4 font-bold text-on-dark transition hover:bg-white/10"
                >
                  <Icon name="phone" className="h-5 w-5 text-primary" />
                  <span>
                    {props.phoneLabel ? <span className="block text-[0.8rem] font-semibold opacity-80">{props.phoneLabel}</span> : null}
                    <span className="block">{formatPhone(phone)}</span>
                  </span>
                </a>
              </div>

              {props.breadcrumbLabel ? (
                <p className="mt-6 text-step--1 text-on-dark-muted">{props.breadcrumbLabel}</p>
              ) : null}

              {/* Trust strip — text, not badge images. */}
              {props.stats.length ? (
                <dl className="mt-12 flex flex-wrap gap-x-12 gap-y-6 border-t border-white/15 pt-8">
                  {props.stats.map((stat) => (
                    <div key={stat.label}>
                      <dd className="text-[2rem] font-extrabold leading-none text-on-dark">{stat.value}</dd>
                      <dt className="mt-2 text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-on-dark-muted">
                        {stat.label}
                      </dt>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>

            {isLanding && form ? (
              <div className="rounded-block border border-line bg-surface p-6 shadow-raised md:p-8">
                {props.quoteFormTitle ? (
                  <h2 className="mb-5 text-step-2">{props.quoteFormTitle}</h2>
                ) : null}
                <QuoteFormClient form={form} compact />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Section>
  )
}

/** Full-width call-to-action banner. Used at the foot of service pages. */
export function CtaBannerBlock({ props }: { props: BlockPropsMap['CtaBanner'] }) {
  const headingId = props.anchor ? `${props.anchor}-heading` : undefined
  return (
    <Section base={{ ...props, background: props.background }} labelledBy={headingId}>
      <div className="relative flex flex-wrap items-center justify-between gap-7 overflow-hidden rounded-block bg-primary px-7 py-9 text-primary-contrast shadow-cta md:px-14 md:py-12">
        <Icon
          name="star"
          className="pointer-events-none absolute -top-6 right-10 h-36 w-36 text-white/10"
          strokeWidth={1}
        />
        <div className="relative max-w-2xl">
          <SectionHeading
            id={headingId}
            heading={props.heading}
            level={props.headingLevel}
            body={props.body}
            onDark
          />
        </div>
        <div className="relative flex flex-wrap gap-4">
          {props.ctas.map((cta, i) => (
            <CtaButton
              key={`${cta.url}-${i}`}
              cta={cta}
              className={
                cta.style === 'primary'
                  ? '!bg-surface-dark !text-on-dark !shadow-none'
                  : '!border-white/40 !bg-white/15 !text-on-dark'
              }
            />
          ))}
        </div>
      </div>
    </Section>
  )
}

/**
 * Service statement — the 2-3 factual sentences that sit directly under the H1
 * on a service page, plus the supporting facts as a list.
 */
export function ServiceStatementBlock({ props }: { props: BlockPropsMap['ServiceStatement'] }) {
  const headingId = props.anchor ? `${props.anchor}-heading` : undefined
  return (
    <Section base={props} labelledBy={headingId}>
      <div className={cn('grid gap-10', props.points.length ? 'lg:grid-cols-[1.2fr_1fr]' : '')}>
        <div>
          <SectionHeading id={headingId} eyebrow={props.eyebrow} heading={props.heading} level={props.headingLevel} />
          {props.statement ? (
            <p className="mt-5 max-w-prose text-[1.03rem] leading-[1.85] text-muted">{props.statement}</p>
          ) : null}
          {props.subheading ? <p className="mt-4 text-step-1 font-semibold">{props.subheading}</p> : null}
        </div>
        {props.points.length ? (
          <ul className="space-y-3">
            {props.points.map((point) => (
              <li key={point.text} className="flex items-start gap-3 text-step-0">
                <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon name="check" className="h-3.5 w-3.5" />
                </span>
                <span className="text-muted">{point.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Section>
  )
}

/** Standalone quote-form block for mid-page placement on service pages. */
export async function QuoteFormBlock({ props }: { props: BlockPropsMap['QuoteForm'] }) {
  const [{ organization }, form] = await Promise.all([getSettings(), getForm(props.formSlug)])
  const headingId = props.anchor ? `${props.anchor}-heading` : undefined
  if (!form) return null

  return (
    <Section base={props} labelledBy={headingId}>
      <div className={cn('mx-auto', props.compact ? 'max-w-3xl' : 'max-w-5xl')}>
        <SectionHeading
          id={headingId}
          eyebrow={props.eyebrow}
          heading={props.heading}
          level={props.headingLevel}
          body={props.body}
          align={props.align}
        />
        <div className="mt-8 rounded-block border border-line bg-surface p-6 shadow-card md:p-10">
          <QuoteFormClient form={form} compact={props.compact} />
        </div>
        {props.showPhone ? (
          <p className="mt-6 text-center text-step-0 text-muted">
            {props.phoneLabel}{' '}
            <a href={telHref(organization.phone)} className="font-bold text-primary underline underline-offset-2">
              {formatPhone(organization.phone)}
            </a>
          </p>
        ) : null}
      </div>
    </Section>
  )
}

/**
 * Trust strip. Certifications render as editable records with a text label and
 * a detail line — never as a badge image with no accessible text, and never as
 * a claim hardcoded into a component.
 */
export async function TrustStripBlock({ props }: { props: BlockPropsMap['TrustStrip'] }) {
  const { trust } = await getSettings()
  const items = props.useTrustSettings ? trust.items : props.items
  if (!items.length) return null
  const headingId = props.anchor ? `${props.anchor}-heading` : undefined

  return (
    <Section base={{ ...props, spacing: props.spacing === 'md' ? 'sm' : props.spacing }} labelledBy={headingId}>
      {props.heading ? <h2 id={headingId} className="mb-6 text-step-2">{props.heading}</h2> : null}
      <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {items.map((item) => {
          const label = (
            <>
              <span aria-hidden className="text-primary">
                &#9670;
              </span>
              <span className="font-bold">{item.label}</span>
              {item.detail ? <span className="text-muted">— {item.detail}</span> : null}
            </>
          )
          return (
            <li key={item.label} className="flex items-center gap-2.5 text-step--1">
              {item.url ? (
                <SmartLink href={item.url} className="flex items-center gap-2.5 hover:text-primary">
                  {label}
                </SmartLink>
              ) : (
                label
              )}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
