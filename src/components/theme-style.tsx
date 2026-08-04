import { getSettings } from '@/lib/settings'

/** Turns "#eb6e2c" + alpha into an rgb(... / a) string for soft/glow tokens. */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const int = parseInt(m[1], 16)
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return `rgb(${r} ${g} ${b} / ${alpha})`
}

/**
 * Emits every design token as a CSS custom property on :root.
 *
 * This is the single place a colour value is allowed to become a literal — all
 * components read the variables, so /admin/appearance restyles the whole site
 * without a deploy and without touching a component.
 */
export async function ThemeStyle() {
  const { theme, fonts, headings, customCss } = await getSettings()

  const scale = (step: number): string => {
    const rem = (fonts.baseSize / 16) * Math.pow(fonts.scaleRatio, step)
    return `${rem.toFixed(4)}rem`
  }

  const levels = (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const)
    .map((level) => {
      const h = headings[level]
      return [
        `--${level}-size:${h.size}`,
        `--${level}-weight:${h.weight}`,
        `--${level}-leading:${h.lineHeight}`,
        `--${level}-mt:${h.marginTop}`,
        `--${level}-mb:${h.marginBottom}`,
        `--${level}-color:${h.color}`,
        `--${level}-transform:${h.transform}`,
      ].join(';')
    })
    .join(';')

  const css = `:root{
--color-primary:${theme.primary};
--color-primary-hover:${theme.primaryHover};
--color-primary-contrast:${theme.primaryContrast};
--color-primary-soft:${withAlpha(theme.primary, 0.12)};
--color-primary-glow:${withAlpha(theme.primary, 0.32)};
--color-secondary:${theme.secondary};
--color-accent:${theme.accent};
--color-background:${theme.background};
--color-surface:${theme.surface};
--color-surface-alt:${theme.surfaceAlt};
--color-surface-dark:${theme.surfaceDark};
--color-text:${theme.text};
--color-muted:${theme.muted};
--color-subtle:${theme.subtle};
--color-border:${theme.border};
--color-on-dark:${theme.onDark};
--color-on-dark-muted:${theme.onDarkMuted};
--color-success:${theme.success};
--color-danger:${theme.danger};
--radius-card:${theme.radiusCard};
--radius-block:${theme.radiusBlock};
--radius-pill:${theme.radiusPill};
--radius-control:${theme.radiusControl};
--container-width:${theme.containerWidth};
--container-width-wide:${theme.containerWidthWide};
--space-section:${theme.spaceSection};
--space-section-lg:${theme.spaceSectionLg};
--space-gutter:${theme.spaceGutter};
--fs--1:${scale(-1)};
--fs-0:${scale(0)};
--fs-1:${scale(1)};
--leading-body:${fonts.lineHeight};
letter-spacing:${fonts.letterSpacing};
${levels};
}
h1{margin-top:var(--h1-mt);margin-bottom:var(--h1-mb);color:var(--h1-color);text-transform:var(--h1-transform)}
h2{margin-top:var(--h2-mt);margin-bottom:var(--h2-mb);color:var(--h2-color);text-transform:var(--h2-transform)}
h3{margin-top:var(--h3-mt);margin-bottom:var(--h3-mb);color:var(--h3-color);text-transform:var(--h3-transform)}
h4{margin-top:var(--h4-mt);margin-bottom:var(--h4-mb);color:var(--h4-color);text-transform:var(--h4-transform)}
h5{margin-top:var(--h5-mt);margin-bottom:var(--h5-mb);color:var(--h5-color);text-transform:var(--h5-transform)}
h6{margin-top:var(--h6-mt);margin-bottom:var(--h6-mb);color:var(--h6-color);text-transform:var(--h6-transform)}
${customCss.global}`

  return <style id="kc-theme" dangerouslySetInnerHTML={{ __html: css }} />
}
