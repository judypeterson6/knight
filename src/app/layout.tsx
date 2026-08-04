import type { Metadata, Viewport } from 'next'
import { Montserrat } from 'next/font/google'
import Script from 'next/script'
import { getSettings } from '@/lib/settings'
import { absoluteUrl } from '@/lib/utils'
import { ThemeStyle } from '@/components/theme-style'
import './globals.css'

/**
 * Fonts are loaded through next/font with display: swap, and only the weights
 * the theme actually selects are fetched — no render-blocking CDN stylesheet,
 * no layout shift when the webfont arrives.
 */
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-montserrat',
  fallback: ['system-ui', 'sans-serif'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#eb6e2c',
  colorScheme: 'light',
}

export async function generateMetadata(): Promise<Metadata> {
  const { seo, branding } = await getSettings()
  return {
    metadataBase: new URL(absoluteUrl('/')),
    title: { default: seo.siteName, template: seo.titleTemplate.replace('%page%', '%s').replace('%site%', seo.siteName) },
    description: seo.defaultDescription,
    applicationName: seo.siteName,
    icons: { icon: branding.favicon },
    verification: {
      google: seo.googleVerification || undefined,
      other: seo.bingVerification ? { 'msvalidate.01': seo.bingVerification } : undefined,
    },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { scripts } = await getSettings()
  const head = scripts.head.filter((s) => s.enabled && s.code.trim())
  const bodyEnd = scripts.bodyEnd.filter((s) => s.enabled && s.code.trim())

  return (
    <html lang="en" className={montserrat.variable}>
      <head>
        <ThemeStyle />
        {head.map((script) => (
          <Script key={script.name} id={`head-${script.name}`} strategy="afterInteractive">
            {script.code}
          </Script>
        ))}
      </head>
      <body>
        {children}
        {bodyEnd.map((script) => (
          <Script key={script.name} id={`body-${script.name}`} strategy="lazyOnload">
            {script.code}
          </Script>
        ))}
      </body>
    </html>
  )
}
