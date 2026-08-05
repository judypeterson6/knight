/**
 * Settings schemas, types and defaults.
 *
 * Deliberately free of `server-only`, Prisma and next/cache imports: this module
 * is also loaded by prisma/seed.ts, which runs under plain tsx with no Next
 * bundler. The server-side reader lives in ./settings.ts.
 *
 * Defaults here reproduce the supplied design source, so the site renders
 * correctly on a fresh install before an admin has touched /admin/appearance.
 */
import { z } from 'zod'

/**
 * Typed, DB-backed settings.
 *
 * Every key is a row in `Setting` (key + JSON value). Defaults below reproduce
 * the supplied design source, so the site is correct on a fresh install and an
 * admin can change any of it from /admin without a deploy.
 */

export const themeSchema = z.object({
  primary: z.string(),
  primaryHover: z.string(),
  primaryContrast: z.string(),
  secondary: z.string(),
  accent: z.string(),
  background: z.string(),
  surface: z.string(),
  surfaceAlt: z.string(),
  surfaceDark: z.string(),
  text: z.string(),
  muted: z.string(),
  subtle: z.string(),
  border: z.string(),
  onDark: z.string(),
  onDarkMuted: z.string(),
  success: z.string(),
  danger: z.string(),
  radiusCard: z.string(),
  radiusBlock: z.string(),
  radiusPill: z.string(),
  radiusControl: z.string(),
  containerWidth: z.string(),
  containerWidthWide: z.string(),
  spaceSection: z.string(),
  spaceSectionLg: z.string(),
  spaceGutter: z.string(),
})

export const fontsSchema = z.object({
  headingFamily: z.string(),
  bodyFamily: z.string(),
  headingWeights: z.array(z.number()),
  bodyWeights: z.array(z.number()),
  baseSize: z.number(),
  scaleRatio: z.number(),
  lineHeight: z.number(),
  letterSpacing: z.string(),
})

const headingLevelSchema = z.object({
  family: z.enum(['heading', 'body']),
  size: z.string(),
  weight: z.number(),
  lineHeight: z.number(),
  marginTop: z.string(),
  marginBottom: z.string(),
  color: z.string(),
  transform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']),
})

export const headingsSchema = z.object({
  h1: headingLevelSchema,
  h2: headingLevelSchema,
  h3: headingLevelSchema,
  h4: headingLevelSchema,
  h5: headingLevelSchema,
  h6: headingLevelSchema,
})

const logoSchema = z.object({
  src: z.string(),
  alt: z.string(),
  width: z.number(),
  height: z.number(),
})

export const brandingSchema = z.object({
  headerLogo: logoSchema,
  stickyLogo: logoSchema,
  footerLogo: logoSchema,
  favicon: z.string(),
  defaultOgImage: z.string(),
})

export const organizationSchema = z.object({
  name: z.string(),
  legalName: z.string(),
  description: z.string(),
  phone: z.string(),
  email: z.string(),
  streetAddress: z.string(),
  addressLocality: z.string(),
  addressRegion: z.string(),
  postalCode: z.string(),
  addressCountry: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  openingHours: z.string(),
  sameAs: z.array(z.object({ label: z.string(), url: z.string(), icon: z.string() })),
})

export const seoSchema = z.object({
  siteName: z.string(),
  titleTemplate: z.string(),
  defaultDescription: z.string(),
  defaultOgImage: z.string(),
  twitterCard: z.string(),
  twitterSite: z.string(),
  googleVerification: z.string(),
  bingVerification: z.string(),
  robotsTxt: z.string(),
})

export const scriptsSchema = z.object({
  head: z.array(z.object({ name: z.string(), code: z.string(), enabled: z.boolean() })),
  bodyEnd: z.array(z.object({ name: z.string(), code: z.string(), enabled: z.boolean() })),
})

export const trustSchema = z.object({
  // Certification claims are editable records, never baked into component copy.
  items: z.array(
    z.object({
      label: z.string(),
      detail: z.string(),
      url: z.string().nullable(),
    }),
  ),
})

export const customCssSchema = z.object({ global: z.string() })

export type ThemeSettings = z.infer<typeof themeSchema>
export type FontSettings = z.infer<typeof fontsSchema>
export type HeadingSettings = z.infer<typeof headingsSchema>
export type BrandingSettings = z.infer<typeof brandingSchema>
export type OrganizationSettings = z.infer<typeof organizationSchema>
export type SeoSettings = z.infer<typeof seoSchema>
export type ScriptSettings = z.infer<typeof scriptsSchema>
export type TrustSettings = z.infer<typeof trustSchema>
export type CustomCssSettings = z.infer<typeof customCssSchema>

export interface SettingsMap {
  theme: ThemeSettings
  fonts: FontSettings
  headings: HeadingSettings
  branding: BrandingSettings
  organization: OrganizationSettings
  seo: SeoSettings
  scripts: ScriptSettings
  trust: TrustSettings
  customCss: CustomCssSettings
}

export type SettingKey = keyof SettingsMap

const heading = (
  size: string,
  weight: number,
  lineHeight: number,
  marginTop: string,
  marginBottom: string,
): z.infer<typeof headingLevelSchema> => ({
  family: 'heading',
  size,
  weight,
  lineHeight,
  marginTop,
  marginBottom,
  color: 'inherit',
  transform: 'none',
})

export const DEFAULTS: SettingsMap = {
  theme: {
    primary: '#eb6e2c',
    primaryHover: '#d85f1e',
    primaryContrast: '#ffffff',
    secondary: '#14110e',
    accent: '#ffc9a3',
    background: '#ffffff',
    surface: '#ffffff',
    surfaceAlt: '#faf8f5',
    surfaceDark: '#14110e',
    text: '#14110e',
    muted: '#7a746c',
    subtle: '#9a938a',
    border: '#eee7dd',
    onDark: '#ffffff',
    onDarkMuted: '#b7afa6',
    success: '#3fbf6a',
    danger: '#e23b2e',
    radiusCard: '20px',
    radiusBlock: '24px',
    radiusPill: '999px',
    radiusControl: '10px',
    containerWidth: '1300px',
    containerWidthWide: '1360px',
    spaceSection: 'clamp(64px, 7vw, 100px)',
    spaceSectionLg: 'clamp(72px, 9vw, 120px)',
    spaceGutter: 'clamp(20px, 4vw, 52px)',
  } satisfies ThemeSettings,

  fonts: {
    headingFamily: 'Montserrat',
    bodyFamily: 'Montserrat',
    headingWeights: [700, 800, 900],
    bodyWeights: [400, 500, 600],
    baseSize: 16,
    scaleRatio: 1.25,
    lineHeight: 1.75,
    letterSpacing: '0em',
  } satisfies FontSettings,

  headings: {
    h1: heading('clamp(2rem, 4vw, 3rem)', 800, 1.06, '0', '1.5rem'),
    h2: heading('clamp(1.7rem, 2.8vw, 2.2rem)', 800, 1.12, '0', '1rem'),
    h3: heading('clamp(1.25rem, 1.6vw, 1.4rem)', 800, 1.2, '0', '0.625rem'),
    h4: heading('1.125rem', 700, 1.3, '0', '0.5rem'),
    h5: heading('1rem', 700, 1.4, '0', '0.5rem'),
    h6: heading('0.8125rem', 700, 1.4, '0', '0.5rem'),
  } satisfies HeadingSettings,

  branding: {
    // Intrinsic size is 500x300; CSS scales it. Both dimensions are always
    // supplied to next/image so the header never shifts on load.
    headerLogo: {
      src: '/brand/Knights-Coaches-Logo.png',
      alt: 'Knights Coaches — Luxury Entertainer',
      width: 500,
      height: 300,
    },
    stickyLogo: {
      src: '/brand/Knights-Coaches-Logo.png',
      alt: 'Knights Coaches — Luxury Entertainer',
      width: 500,
      height: 300,
    },
    footerLogo: {
      src: '/brand/Knights-Coaches-Footer-Logo.png',
      alt: 'Knights Coaches — Luxury Entertainer',
      width: 500,
      height: 300,
    },
    favicon: '/brand/favicon.png',
    defaultOgImage: '/uploads/2026/05/Outlaw-Tour-Bus-1024x691.png',
  } satisfies BrandingSettings,

  organization: {
    name: 'Knights Coaches',
    legalName: 'Knights Coaches',
    description:
      'Knights Coaches is your trusted partner for premium coach and entertainer bus services across the USA. We combine comfort, safety, and style to make every journey unforgettable.',
    phone: '8557345700',
    email: 'info@knightscoaches.com',
    streetAddress: '137 National Plaza Suite 300',
    addressLocality: 'National Harbor',
    addressRegion: 'MD',
    postalCode: '20745',
    addressCountry: 'US',
    latitude: null,
    longitude: null,
    openingHours: 'Mo-Su 00:00-23:59',
    sameAs: [
      { label: 'Facebook', url: '', icon: 'facebook' },
      { label: 'X', url: '', icon: 'x' },
      { label: 'LinkedIn', url: '', icon: 'linkedin' },
      { label: 'Instagram', url: '', icon: 'instagram' },
    ],
  } satisfies OrganizationSettings,

  seo: {
    siteName: 'Knights Coaches',
    titleTemplate: '%page% | %site%',
    defaultDescription:
      'Entertainer coach rental on custom Prevost H3-45 and X3-45 platforms across all 48 states. 6 to 14 bunks, full galleys, private lounges, onboard showers, CDL-certified drivers and 24/7 dispatch.',
    defaultOgImage: '/uploads/2026/05/Outlaw-Tour-Bus-1024x691.png',
    twitterCard: 'summary_large_image',
    twitterSite: '',
    googleVerification: '',
    bingVerification: '',
    robotsTxt: '',
  } satisfies SeoSettings,

  scripts: { head: [], bodyEnd: [] } satisfies ScriptSettings,

  trust: {
    items: [
      { label: 'CDL-certified drivers', detail: 'Class A or B, three-year minimum on entertainer coaches', url: null },
      { label: 'EMC member', detail: 'Entertainer Motorcoach Council membership', url: null },
      { label: 'US DOT registered', detail: 'Satisfactory FMCSA safety rating', url: null },
      { label: '24/7 dispatch', detail: 'Live routing and support, coast to coast', url: null },
      { label: '48 states served', detail: 'Pickup and drop-off in any major US city', url: null },
    ],
  } satisfies TrustSettings,

  customCss: { global: '' },
}

export const SCHEMAS = {
  theme: themeSchema,
  fonts: fontsSchema,
  headings: headingsSchema,
  branding: brandingSchema,
  organization: organizationSchema,
  seo: seoSchema,
  scripts: scriptsSchema,
  trust: trustSchema,
  customCss: customCssSchema,
} satisfies Record<SettingKey, z.ZodTypeAny>

export function schemaFor(key: SettingKey): z.ZodTypeAny {
  return SCHEMAS[key]
}

