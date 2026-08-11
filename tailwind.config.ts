import type { Config } from 'tailwindcss'

/**
 * Every colour, radius, container width and spacing step resolves to a CSS
 * custom property that is emitted from the `Setting` table at request time
 * (see src/lib/theme.ts). Components therefore never carry a literal hex —
 * changing the palette in /admin/appearance restyles the whole site.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          deep: 'var(--color-primary-deep)',
          soft: 'var(--color-primary-soft)',
          contrast: 'var(--color-primary-contrast)',
        },
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        background: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          alt: 'var(--color-surface-alt)',
          dark: 'var(--color-surface-dark)',
        },
        ink: 'var(--color-text)',
        muted: 'var(--color-muted)',
        subtle: 'var(--color-subtle)',
        line: 'var(--color-border)',
        success: 'var(--color-success)',
        danger: 'var(--color-danger)',
        'on-dark': 'var(--color-on-dark)',
        'on-dark-muted': 'var(--color-on-dark-muted)',
      },
      fontFamily: {
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
      },
      fontSize: {
        'step--1': 'var(--fs--1)',
        'step-0': 'var(--fs-0)',
        'step-1': 'var(--fs-1)',
        'step-2': 'var(--fs-2)',
        'step-3': 'var(--fs-3)',
        'step-4': 'var(--fs-4)',
        'step-5': 'var(--fs-5)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        block: 'var(--radius-block)',
        pill: 'var(--radius-pill)',
        control: 'var(--radius-control)',
      },
      maxWidth: {
        container: 'var(--container-width)',
        'container-wide': 'var(--container-width-wide)',
        prose: 'var(--prose-width)',
      },
      spacing: {
        section: 'var(--space-section)',
        'section-lg': 'var(--space-section-lg)',
        gutter: 'var(--space-gutter)',
      },
      boxShadow: {
        card: '0 18px 46px rgb(0 0 0 / 0.07)',
        'card-hover': '0 38px 76px rgb(0 0 0 / 0.15)',
        raised: '0 22px 60px rgb(0 0 0 / 0.28)',
        cta: '0 16px 38px var(--color-primary-glow)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(.16,.8,.24,1)',
      },
    },
  },
  plugins: [],
}

export default config
