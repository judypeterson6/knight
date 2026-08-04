import { z } from 'zod'
import { BLOCK_TYPES } from '@/lib/blocks/schema'

/** Zod schemas for every admin mutation. Nothing is written without one. */

const slug = z
  .string()
  .min(1)
  .max(190)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only')

const routePath = z
  .string()
  .min(1)
  .max(300)
  .regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/, 'Use a leading-slash path with no trailing slash')

const status = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'])

// --- Pages -----------------------------------------------------------------

export const pageCreateSchema = z.object({
  path: routePath,
  slug,
  title: z.string().min(1).max(300),
  pageType: z.string().min(1).max(40).default('service'),
  status: status.default('DRAFT'),
  customCss: z.string().max(20_000).nullable().optional(),
})

export const pageUpdateSchema = pageCreateSchema.partial().extend({
  publishedAt: z.string().datetime().nullable().optional(),
})

export const blockSchema = z.object({
  id: z.string().optional(),
  type: z.enum(BLOCK_TYPES),
  order: z.number().int().min(0),
  visible: z.boolean().default(true),
  props: z.record(z.string(), z.unknown()),
})

export const blocksSaveSchema = z.object({
  blocks: z.array(blockSchema).max(120),
  /** Stores a restorable snapshot before applying the change. */
  createRevision: z.boolean().default(true),
  note: z.string().max(300).optional(),
})

// --- Posts -----------------------------------------------------------------

export const postCreateSchema = z.object({
  slug,
  title: z.string().min(1).max(300),
  excerpt: z.string().max(5_000).nullable().optional(),
  body: z.string().default(''),
  status: status.default('DRAFT'),
  categoryId: z.string().nullable().optional(),
  featuredImageId: z.string().nullable().optional(),
  authorId: z.string().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
})

export const postUpdateSchema = postCreateSchema.partial()

// --- Categories ------------------------------------------------------------

export const categoryCreateSchema = z.object({
  slug,
  name: z.string().min(1).max(200),
  description: z.string().max(5_000).nullable().optional(),
  parentId: z.string().nullable().optional(),
  order: z.number().int().min(0).default(0),
})

export const categoryUpdateSchema = categoryCreateSchema.partial()

// --- Fleet -----------------------------------------------------------------

export const coachCreateSchema = z.object({
  slug,
  name: z.string().min(1).max(200),
  status: status.default('DRAFT'),
  classId: z.string().nullable().optional(),
  chassis: z.string().min(1).max(120),
  bunks: z.number().int().min(1).max(40),
  slideOuts: z.string().min(1).max(120),
  rearConfig: z.string().min(1).max(160),
  amenities: z.array(z.string().max(300)).default([]),
  description: z.string().default(''),
  tagline: z.string().max(160).nullable().optional(),
  // Whole USD. Null means "quoted per tour" — a real state, not a missing value.
  dailyPrice: z.number().int().min(0).max(100_000).nullable().optional(),
  currency: z.string().length(3).default('USD'),
  available: z.boolean().default(true),
  featured: z.boolean().default(false),
  displayOrder: z.number().int().min(0).default(0),
})

export const coachUpdateSchema = coachCreateSchema.partial()

export const coachImagesSchema = z.object({
  images: z
    .array(z.object({ mediaId: z.string(), order: z.number().int().min(0), caption: z.string().max(400).nullable() }))
    .max(40),
})

export const coachClassCreateSchema = z.object({
  slug,
  name: z.string().min(1).max(120),
  description: z.string().max(5_000).nullable().optional(),
  order: z.number().int().min(0).default(0),
})

export const coachClassUpdateSchema = coachClassCreateSchema.partial()

// --- Locations, testimonials, FAQs -----------------------------------------

export const locationCreateSchema = z.object({
  slug,
  city: z.string().min(1).max(160),
  state: z.string().max(80).default(''),
  region: z.string().max(80).nullable().optional(),
  path: routePath.nullable().optional(),
  status: status.default('DRAFT'),
  isHub: z.boolean().default(false),
  isPrimary: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
  summary: z.string().max(5_000).nullable().optional(),
  imageId: z.string().nullable().optional(),
})

export const locationUpdateSchema = locationCreateSchema.partial()

export const testimonialCreateSchema = z.object({
  slug,
  name: z.string().min(1).max(160),
  role: z.string().min(1).max(160),
  quote: z.string().min(1).max(5_000),
  rating: z.number().int().min(1).max(5).default(5),
  status: status.default('DRAFT'),
  avatarId: z.string().nullable().optional(),
  order: z.number().int().min(0).default(0),
})

export const testimonialUpdateSchema = testimonialCreateSchema.partial()

export const faqCreateSchema = z.object({
  slug,
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(5_000),
  group: z.string().min(1).max(120),
  order: z.number().int().min(0).default(0),
  status: status.default('PUBLISHED'),
})

export const faqUpdateSchema = faqCreateSchema.partial()

// --- Media -----------------------------------------------------------------

export const mediaUpdateSchema = z
  .object({
    alt: z.string().max(500),
    decorative: z.boolean().default(false),
    title: z.string().max(255).nullable().optional(),
    caption: z.string().max(5_000).nullable().optional(),
  })
  .refine((value) => value.decorative || value.alt.trim().length > 0, {
    message: 'Alt text is required unless the image is explicitly marked decorative',
    path: ['alt'],
  })

// --- Menus -----------------------------------------------------------------

export const menuItemSchema = z.object({
  id: z.string().optional(),
  parentId: z.string().nullable().optional(),
  kind: z.enum(['PAGE', 'POST', 'COACH', 'CATEGORY', 'CUSTOM', 'PHONE']).default('CUSTOM'),
  label: z.string().min(1).max(200),
  url: z.string().min(1).max(600),
  column: z.number().int().min(1).max(6).nullable().optional(),
  order: z.number().int().min(0),
  rel: z.string().max(120).nullable().optional(),
  target: z.string().max(20).nullable().optional(),
  visible: z.boolean().default(true),
  isCta: z.boolean().default(false),
})

export const menuSaveSchema = z.object({ items: z.array(menuItemSchema).max(120) })

// --- Users -----------------------------------------------------------------

export const userCreateSchema = z.object({
  name: z.string().min(1).max(190),
  email: z.string().email().max(320),
  password: z.string().min(10, 'Use at least 10 characters').max(200),
  role: z.enum(['ADMIN', 'EDITOR', 'AUTHOR']).default('AUTHOR'),
  bio: z.string().max(5_000).nullable().optional(),
  active: z.boolean().default(true),
  avatarId: z.string().nullable().optional(),
})

export const userUpdateSchema = userCreateSchema.partial().omit({ password: true }).extend({
  password: z.string().min(10).max(200).optional(),
})

export const profileUpdateSchema = z.object({
  name: z.string().min(1).max(190),
  bio: z.string().max(5_000).nullable().optional(),
  avatarId: z.string().nullable().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(10).max(200).optional(),
})

// --- SEO -------------------------------------------------------------------

export const seoUpdateSchema = z.object({
  entityType: z.enum(['PAGE', 'POST', 'COACH', 'CATEGORY', 'LOCATION']),
  entityId: z.string().min(1),
  title: z.string().max(300).nullable().optional(),
  description: z.string().max(5_000).nullable().optional(),
  canonical: z.string().max(600).nullable().optional(),
  ogTitle: z.string().max(300).nullable().optional(),
  ogDescription: z.string().max(5_000).nullable().optional(),
  ogImage: z.string().max(600).nullable().optional(),
  robots: z.enum(['INDEX_FOLLOW', 'NOINDEX_FOLLOW', 'INDEX_NOFOLLOW', 'NOINDEX_NOFOLLOW']).default('INDEX_FOLLOW'),
  schemaType: z.string().max(80).nullable().optional(),
  sitemapExclude: z.boolean().default(false),
  sitemapPriority: z.number().min(0).max(1).nullable().optional(),
  sitemapChangefreq: z.string().max(20).nullable().optional(),
  // Deliberately absent: keywords. Deprecated signal, no column, no field.
})

export const schemaOverrideSchema = z.object({
  entityType: z.enum(['PAGE', 'POST', 'COACH', 'CATEGORY', 'LOCATION']),
  entityId: z.string().min(1),
  jsonLd: z.unknown(),
  replace: z.boolean().default(false),
  enabled: z.boolean().default(true),
})

// --- Redirects -------------------------------------------------------------

export const redirectCreateSchema = z.object({
  from: routePath,
  to: z.string().min(1).max(600),
  kind: z.enum(['PERMANENT', 'TEMPORARY']).default('PERMANENT'),
  enabled: z.boolean().default(true),
  note: z.string().max(300).nullable().optional(),
})

export const redirectUpdateSchema = redirectCreateSchema.partial()

export const redirectImportSchema = z.object({ csv: z.string().max(1_000_000) })

// --- Indexing --------------------------------------------------------------

export const indexingSubmitSchema = z.object({
  urls: z.array(z.string().min(1).max(600)).min(1).max(500),
  providers: z.array(z.enum(['INDEXNOW', 'GOOGLE', 'SITEMAP_PING'])).min(1),
  action: z.enum(['URL_UPDATED', 'URL_DELETED']).default('URL_UPDATED'),
})

export const indexingRetrySchema = z.object({ ids: z.array(z.string()).min(1).max(200) })

// --- Settings --------------------------------------------------------------

export const settingUpdateSchema = z.object({ value: z.record(z.string(), z.unknown()) })

// --- Forms -----------------------------------------------------------------

export const formUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5_000).nullable().optional(),
  submitLabel: z.string().max(120).optional(),
  successTitle: z.string().max(200).optional(),
  successBody: z.string().max(5_000).optional(),
  notifyEmail: z.string().email().max(320).nullable().optional(),
  enabled: z.boolean().optional(),
})

export const formFieldsSchema = z.object({
  fields: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z
          .string()
          .min(1)
          .max(120)
          .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers and underscores'),
        label: z.string().min(1).max(300),
        type: z.enum(['TEXT', 'EMAIL', 'TEL', 'NUMBER', 'DATE', 'TEXTAREA', 'SELECT', 'CHECKBOX', 'FILE', 'HIDDEN']),
        placeholder: z.string().max(300).nullable().optional(),
        helpText: z.string().max(400).nullable().optional(),
        required: z.boolean().default(false),
        options: z.array(z.string().max(200)).nullable().optional(),
        order: z.number().int().min(0),
        showWhen: z.string().max(120).nullable().optional(),
        halfWidth: z.boolean().default(true),
      }),
    )
    .max(60),
})

export const messageUpdateSchema = z.object({
  read: z.boolean().optional(),
  starred: z.boolean().optional(),
})
