import { Section, SmartLink } from '@/components/ui/primitives'

export default function NotFound() {
  return (
    <Section base={{ background: 'surface', spacing: 'lg', align: 'center', anchor: '', className: 'pt-32 md:pt-40' }}>
      <p className="kc-eyebrow mb-4" data-rules="both">
        <span>404</span>
      </p>
      <h1>This page has moved or never existed</h1>
      <p className="mx-auto mt-5 max-w-xl text-step-0 text-muted">
        Every URL from the previous site is redirected. If you followed a link and landed here, start from one of these.
      </p>
      <ul className="mt-9 flex flex-wrap justify-center gap-4">
        <li>
          <SmartLink href="/" className="kc-btn kc-btn-primary">
            Home
          </SmartLink>
        </li>
        <li>
          <SmartLink href="/fleet" className="kc-btn kc-btn-outline">
            Browse the fleet
          </SmartLink>
        </li>
        <li>
          <SmartLink href="/contact-us" className="kc-btn kc-btn-outline">
            Request a quote
          </SmartLink>
        </li>
        <li>
          <SmartLink href="/sitemap" className="kc-btn kc-btn-outline">
            Full sitemap
          </SmartLink>
        </li>
      </ul>
    </Section>
  )
}
