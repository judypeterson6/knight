/**
 * Database seed.
 *
 * Consumes the migration snapshot in prisma/seed-data (produced by
 * `npm run migrate:wp`) and builds the running site: the admin user, every
 * migrated page with its real blocks and real copy, all posts, all coaches, all
 * FAQs, both menus, the per-URL SEO metadata and every redirect.
 *
 * Page composition lives in ./seed-blocks.ts as pure functions, so
 * `npm run verify` can execute and validate every block this seed will write
 * before a database connection is ever opened.
 *
 * Idempotent: everything upserts on a natural key, so re-running is safe.
 */

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import { PrismaClient, type ContentStatus, type RobotsDirective } from '@prisma/client'
import { DEFAULTS } from '../src/lib/settings-defaults'
import {
  BESPOKE_ROUTES,
  FLEET_FAQS,
  HOME_FAQS,
  LEGAL_PAGES,
  NATIONWIDE_FAQS,
  buildAboutBlocks,
  buildContactBlocks,
  buildContext,
  buildFleetBlocks,
  buildGenericBlocks,
  buildHomeBlocks,
  buildLegalBlocks,
  heroImageFor,
  type LocationRecord,
  type MediaRecord,
  type PageRecord,
  type SeedBlock,
  type SeoRecord,
} from './seed-blocks'

const prisma = new PrismaClient()
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'prisma', 'seed-data')

// ---------------------------------------------------------------------------
// Snapshot types not needed by the block builders
// ---------------------------------------------------------------------------

interface PostRecord {
  wpId: number
  wpUrl: string
  slug: string
  title: string
  excerpt: string
  body: string
  status: 'PUBLISHED' | 'DRAFT'
  publishedAt: string | null
  categorySlug: string | null
  featuredImage: string | null
  seo: SeoRecord
}

interface CoachRecord {
  slug: string
  name: string
  className: string
  chassis: string
  bunks: number
  slideOuts: string
  rearConfig: string
  amenities: string[]
  dailyPrice: number | null
  tagline: string | null
  description: string
  images: string[]
  featured: boolean
  displayOrder: number
}

interface TestimonialRecord {
  slug: string
  name: string
  role: string
  quote: string
  rating: number
  avatar: string | null
  order: number
}

interface CategoryRecord {
  wpId: number
  slug: string
  name: string
  description: string
  parentWpId: number | null
}

interface RedirectRecord {
  from: string
  to: string
  kind: 'PERMANENT' | 'TEMPORARY'
  note: string
}

export function loadSnapshot<T>(file: string, fallback: T): T {
  const full = path.join(DATA, file)
  if (!existsSync(full)) {
    console.warn(`  ! ${file} not found — run "npm run migrate:wp" first. Continuing without it.`)
    return fallback
  }
  return JSON.parse(readFileSync(full, 'utf8')) as T
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('\n  Seeding knightscoaches.com\n')

  const pages = loadSnapshot<PageRecord[]>('pages.json', [])
  const posts = loadSnapshot<PostRecord[]>('posts.json', [])
  const categories = loadSnapshot<CategoryRecord[]>('categories.json', [])
  const mediaRecords = loadSnapshot<MediaRecord[]>('media.json', [])
  const coaches = loadSnapshot<CoachRecord[]>('coaches.json', [])
  const locations = loadSnapshot<LocationRecord[]>('locations.json', [])
  const testimonials = loadSnapshot<TestimonialRecord[]>('testimonials.json', [])
  const redirects = loadSnapshot<RedirectRecord[]>('redirects.json', [])

  const ctx = buildContext(pages, locations, mediaRecords)

  // --- Settings -------------------------------------------------------------
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value: value as object }, update: {} })
  }
  console.log(`  settings        ${Object.keys(DEFAULTS).length}`)

  // --- Admin user -----------------------------------------------------------
  const adminEmail = (process.env.ADMIN_EMAIL || 'info@knightscoaches.com').toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD || 'change-this-before-deploying'
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: process.env.ADMIN_NAME || 'Knights Coaches Admin',
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: 'ADMIN',
      bio: 'Dispatch and operations, Knights Coaches.',
      active: true,
    },
    update: { role: 'ADMIN', active: true },
  })
  console.log(`  admin user      ${admin.email}`)

  // --- Media ----------------------------------------------------------------
  const mediaIdByPath = new Map<string, string>()
  for (const record of mediaRecords) {
    const row = await prisma.media.upsert({
      where: { path: record.path },
      create: {
        path: record.path,
        sourceUrl: record.sourceUrl,
        filename: record.filename,
        mimeType: record.mimeType,
        width: record.width,
        height: record.height,
        bytes: record.bytes,
        alt: record.alt,
        // An asset that arrived from WordPress with no alt text is flagged, not
        // silently treated as decorative — it surfaces in the admin SEO audit.
        decorative: false,
        title: record.title,
        caption: record.caption,
      },
      update: { width: record.width, height: record.height, bytes: record.bytes },
    })
    mediaIdByPath.set(record.path, row.id)
  }
  console.log(`  media           ${mediaIdByPath.size}`)

  // --- Coach classes and coaches -------------------------------------------
  const CLASS_DESCRIPTIONS: Record<string, string> = {
    Elite:
      'Prevost X3-45 platform. The highest interior specification in the fleet, with the largest slide-out configurations and private rear staterooms.',
    Premium:
      'Prevost H3-45 high-deck platform. Generous headroom, large under-floor storage bays and single or double slide-out layouts.',
    Standard:
      'Prevost H3-45 units configured for crew travel rather than artist travel — fewer bunks, single slide, rear lounge.',
  }

  const classIdByName = new Map<string, string>()
  for (const [index, name] of [...new Set(coaches.map((c) => c.className))].entries()) {
    const row = await prisma.coachClass.upsert({
      where: { slug: name.toLowerCase() },
      create: {
        slug: name.toLowerCase(),
        name,
        description: CLASS_DESCRIPTIONS[name] ?? `${name} class coaches.`,
        order: index,
      },
      update: { name, description: CLASS_DESCRIPTIONS[name] ?? undefined },
    })
    classIdByName.set(name, row.id)
  }

  for (const coach of coaches) {
    const row = await prisma.coach.upsert({
      where: { slug: coach.slug },
      create: {
        slug: coach.slug,
        name: coach.name,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        classId: classIdByName.get(coach.className) ?? null,
        chassis: coach.chassis,
        bunks: coach.bunks,
        slideOuts: coach.slideOuts,
        rearConfig: coach.rearConfig,
        amenities: coach.amenities,
        description: coach.description,
        tagline: coach.tagline,
        // Left unset: the source publishes a fleet-wide $180–$320 daily band but
        // no per-coach figure, and inventing one would be worse than none. Set
        // real prices in /admin/fleet and the price filter and Product offer
        // both activate automatically.
        dailyPrice: coach.dailyPrice,
        available: true,
        featured: coach.featured,
        displayOrder: coach.displayOrder,
      },
      update: {
        chassis: coach.chassis,
        bunks: coach.bunks,
        slideOuts: coach.slideOuts,
        rearConfig: coach.rearConfig,
        amenities: coach.amenities,
        description: coach.description,
      },
    })

    for (const [order, imagePath] of coach.images.entries()) {
      const mediaId = mediaIdByPath.get(imagePath)
      if (!mediaId) continue
      await prisma.coachImage.upsert({
        where: { coachId_mediaId: { coachId: row.id, mediaId } },
        create: {
          coachId: row.id,
          mediaId,
          order,
          caption: `${coach.name} — ${coach.chassis}, ${coach.bunks} bunks, ${coach.slideOuts.toLowerCase()}, ${coach.rearConfig.toLowerCase()}.`,
        },
        update: { order },
      })
    }
  }
  console.log(`  coaches         ${coaches.length} in ${classIdByName.size} classes`)

  // --- Locations ------------------------------------------------------------
  for (const location of locations) {
    await prisma.location.upsert({
      where: { slug: location.slug },
      create: {
        slug: location.slug,
        city: location.city,
        state: location.state,
        region: location.region,
        path: location.route,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        isHub: location.isHub,
        isPrimary: location.isHub,
        order: location.order,
        summary: location.summary,
        imageId: location.image ? (mediaIdByPath.get(location.image) ?? null) : null,
      },
      update: { city: location.city, state: location.state, region: location.region, path: location.route },
    })
  }
  console.log(`  locations       ${locations.length}`)

  // --- Testimonials ---------------------------------------------------------
  for (const testimonial of testimonials) {
    await prisma.testimonial.upsert({
      where: { slug: testimonial.slug },
      create: {
        slug: testimonial.slug,
        name: testimonial.name,
        role: testimonial.role,
        quote: testimonial.quote,
        rating: testimonial.rating,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        order: testimonial.order,
        avatarId: testimonial.avatar ? (mediaIdByPath.get(testimonial.avatar) ?? null) : null,
      },
      update: { quote: testimonial.quote, role: testimonial.role },
    })
  }
  console.log(`  testimonials    ${testimonials.length}`)

  // --- FAQs -----------------------------------------------------------------
  const faqGroups: [string, { question: string; answer: string }[]][] = [
    ['home', HOME_FAQS],
    ['entertainer-coach', HOME_FAQS],
    ['nationwide', NATIONWIDE_FAQS],
    ['fleet', FLEET_FAQS],
    ['tour-bus-rental', NATIONWIDE_FAQS],
  ]
  let faqCount = 0
  for (const [group, items] of faqGroups) {
    for (const [order, item] of items.entries()) {
      const slug = `${group}-${order + 1}`
      await prisma.faqItem.upsert({
        where: { slug },
        create: {
          slug,
          group,
          order,
          question: item.question,
          answer: item.answer,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
        update: { question: item.question, answer: item.answer, order },
      })
      faqCount += 1
    }
  }
  console.log(`  faq items       ${faqCount}`)

  // --- Categories and posts -------------------------------------------------
  const categoryIdBySlug = new Map<string, string>()
  for (const [index, category] of categories.entries()) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        slug: category.slug,
        name: category.name,
        description:
          category.slug === 'blog'
            ? 'Practical guides on touring logistics, coach specification and life on the road.'
            : category.description,
        wpId: category.wpId,
        order: index,
      },
      update: { name: category.name },
    })
    categoryIdBySlug.set(category.slug, row.id)
  }

  for (const post of posts) {
    await prisma.post.upsert({
      where: { slug: post.slug },
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        body: post.body,
        status: post.status as ContentStatus,
        publishedAt: post.publishedAt ? new Date(post.publishedAt) : new Date(),
        wpId: post.wpId,
        wpUrl: post.wpUrl,
        authorId: admin.id,
        categoryId: post.categorySlug ? (categoryIdBySlug.get(post.categorySlug) ?? null) : null,
        featuredImageId: post.featuredImage ? (mediaIdByPath.get(post.featuredImage) ?? null) : null,
      },
      update: { title: post.title, body: post.body, excerpt: post.excerpt },
    })
  }
  console.log(`  posts           ${posts.length} in ${categories.length} categories`)

  // --- Forms ----------------------------------------------------------------
  await seedForms()

  // --- Pages ----------------------------------------------------------------
  let pageCount = 0

  const writePage = async (input: {
    route: string
    slug: string
    title: string
    pageType: string
    blocks: SeedBlock[]
    seo?: SeoRecord
    wpId?: number | null
    wpUrl?: string | null
    publishedAt?: Date
    heroImagePath?: string | null
  }): Promise<void> => {
    const page = await prisma.page.upsert({
      where: { path: input.route },
      create: {
        path: input.route,
        slug: input.slug,
        title: input.title,
        pageType: input.pageType,
        status: 'PUBLISHED',
        publishedAt: input.publishedAt ?? new Date(),
        wpId: input.wpId ?? null,
        wpUrl: input.wpUrl ?? null,
        heroImageId: input.heroImagePath ? (mediaIdByPath.get(input.heroImagePath) ?? null) : null,
      },
      update: { title: input.title, pageType: input.pageType, status: 'PUBLISHED' },
    })

    // Blocks are replaced wholesale so a re-seed reflects the current template.
    await prisma.pageBlock.deleteMany({ where: { pageId: page.id } })
    await prisma.pageBlock.createMany({
      data: input.blocks.map((b, order) => ({
        pageId: page.id,
        type: b.type,
        order,
        visible: true,
        props: b.props as object,
      })),
    })

    if (input.seo) {
      await prisma.seoMeta.upsert({
        where: { entityType_entityId: { entityType: 'PAGE', entityId: page.id } },
        create: {
          entityType: 'PAGE',
          entityId: page.id,
          title: input.seo.title,
          description: input.seo.description,
          canonical: input.seo.canonical,
          ogTitle: input.seo.ogTitle,
          ogDescription: input.seo.ogDescription,
          ogImage: input.seo.ogImage,
          robots: input.seo.robots as RobotsDirective,
        },
        update: { title: input.seo.title, description: input.seo.description, ogImage: input.seo.ogImage },
      })
    }
    pageCount += 1
  }

  const bespoke: { route: string; slug: string; title: string; pageType: string; blocks: SeedBlock[] }[] = [
    { route: '/', slug: 'home', title: 'Entertainer Coach Rental Nationwide', pageType: 'home', blocks: buildHomeBlocks(ctx) },
    { route: '/fleet', slug: 'fleet', title: 'Our Fleet', pageType: 'fleet-listing', blocks: buildFleetBlocks(ctx) },
    { route: '/contact-us', slug: 'contact-us', title: 'Contact Us', pageType: 'contact', blocks: buildContactBlocks(ctx) },
    { route: '/about-us', slug: 'about-us', title: 'About Us', pageType: 'about', blocks: buildAboutBlocks(ctx) },
  ]

  for (const entry of bespoke) {
    const source = ctx.pageByRoute.get(entry.route)
    await writePage({
      ...entry,
      wpId: source?.wpId ?? null,
      wpUrl: source?.wpUrl ?? null,
      heroImagePath: heroImageFor(source, ctx.fallbackHero),
      seo: source?.seo,
    })
  }

  for (const page of pages) {
    if (BESPOKE_ROUTES.has(page.route)) continue
    await writePage({
      route: page.route,
      slug: page.slug,
      title: page.title,
      pageType: page.pageType,
      wpId: page.wpId,
      wpUrl: page.wpUrl,
      heroImagePath: heroImageFor(page, ctx.fallbackHero),
      seo: page.seo,
      publishedAt: page.publishedAt ? new Date(page.publishedAt) : new Date(),
      blocks: buildGenericBlocks(page, ctx),
    })
  }

  for (const legal of LEGAL_PAGES) {
    await writePage({
      route: legal.route,
      slug: legal.route.slice(1),
      title: legal.title,
      pageType: 'legal',
      blocks: buildLegalBlocks(legal, ctx),
      seo: {
        title: legal.title,
        description: legal.intro,
        canonical: legal.route,
        ogTitle: null,
        ogDescription: null,
        ogImage: null,
        robots: 'INDEX_FOLLOW',
      },
    })
  }
  console.log(`  pages           ${pageCount}`)

  // --- Post SEO -------------------------------------------------------------
  for (const post of posts) {
    const row = await prisma.post.findUnique({ where: { slug: post.slug }, select: { id: true } })
    if (!row) continue
    await prisma.seoMeta.upsert({
      where: { entityType_entityId: { entityType: 'POST', entityId: row.id } },
      create: {
        entityType: 'POST',
        entityId: row.id,
        title: post.seo.title,
        description: post.seo.description,
        canonical: `/blog/${post.slug}`,
        ogImage: post.seo.ogImage,
        robots: post.seo.robots as RobotsDirective,
        schemaType: 'BlogPosting',
      },
      update: { title: post.seo.title, description: post.seo.description },
    })
  }

  // --- Menus ----------------------------------------------------------------
  await seedMenus()

  // --- Redirects ------------------------------------------------------------
  for (const redirect of redirects) {
    await prisma.redirect.upsert({
      where: { from: redirect.from },
      create: { from: redirect.from, to: redirect.to, kind: redirect.kind, note: redirect.note, enabled: true },
      update: { to: redirect.to, kind: redirect.kind, note: redirect.note },
    })
  }
  console.log(`  redirects       ${redirects.length}`)

  console.log('\n  Seed complete.\n')
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

async function seedForms(): Promise<void> {
  const quote = await prisma.form.upsert({
    where: { slug: 'quote-request' },
    create: {
      slug: 'quote-request',
      name: 'Request a quote',
      description:
        'Tell us about your tour. The more detail you give us, the more accurate the quote — and the faster we can hold a coach for your dates.',
      submitLabel: 'Send request',
      successTitle: 'Request received',
      successBody:
        'Thanks for reaching out. Our dispatch team will be in touch within the hour. Need it sooner? Call 855 734 5700.',
      notifyEmail: process.env.FORM_NOTIFY_EMAIL || 'info@knightscoaches.com',
      enabled: true,
    },
    update: {},
  })

  // Four short steps rather than one seventeen-field wall. Step boundaries and
  // titles live on the fields, so an editor can regroup them in /admin/forms.
  const quoteFields: {
    name: string
    label: string
    type: 'TEXT' | 'EMAIL' | 'TEL' | 'NUMBER' | 'DATE' | 'TEXTAREA' | 'SELECT' | 'CHECKBOX'
    required?: boolean
    helpText?: string
    options?: string[]
    halfWidth?: boolean
    showWhen?: string
    step: number
    stepTitle?: string
  }[] = [
    // Step 1 — the trip
    { step: 1, stepTitle: 'Your tour', name: 'pickup_location', label: 'Pick-up location', type: 'TEXT', helpText: 'City and state' },
    { step: 1, name: 'dropoff_location', label: 'Drop-off location', type: 'TEXT', helpText: 'City and state' },
    { step: 1, name: 'pickup_date', label: 'Pick-up date', type: 'DATE', required: true },
    { step: 1, name: 'return_date', label: 'Return date', type: 'DATE', required: true },

    // Step 2 — who you are
    { step: 2, stepTitle: 'Your details', name: 'name', label: 'Name', type: 'TEXT', required: true },
    { step: 2, name: 'job_title', label: 'Your title', type: 'TEXT' },
    { step: 2, name: 'email', label: 'Email', type: 'EMAIL', required: true },
    { step: 2, name: 'phone', label: 'Phone number', type: 'TEL', required: true },
    { step: 2, name: 'artist_name', label: 'Artist or organisation name', type: 'TEXT' },

    // Step 3 — what you need
    { step: 3, stepTitle: 'Coaches', name: 'coach_count', label: 'Number of coaches', type: 'NUMBER', required: true },
    { step: 3, name: 'crew_size', label: 'Crew size', type: 'NUMBER', helpText: 'How many people need a bunk' },
    {
      step: 3,
      name: 'coach_class',
      label: 'Coach class preference',
      type: 'SELECT',
      options: ['No preference', 'Elite', 'Premium', 'Standard'],
    },

    // Step 4 — trucking and anything else
    {
      step: 4,
      stepTitle: 'Trucking and notes',
      name: 'needs_trucking',
      label: 'Yes, please quote tour trucking as well',
      type: 'CHECKBOX',
      halfWidth: false,
      helpText: 'Enclosed trailers, box trucks and flatbeds travelling alongside the coach.',
    },
    { step: 4, name: 'truck_count', label: 'Number of tour trucks', type: 'NUMBER', showWhen: 'needs_trucking' },
    {
      step: 4,
      name: 'trailer_type',
      label: 'Trailer type',
      type: 'SELECT',
      options: ['Enclosed trailer', 'Box truck', 'Flatbed', 'Not sure'],
      showWhen: 'needs_trucking',
    },
    {
      step: 4,
      name: 'additional_information',
      label: 'Additional information',
      type: 'TEXTAREA',
      required: true,
      halfWidth: false,
      helpText: 'Routing, special requests, load-in constraints — anything that affects the quote.',
    },
  ]

  for (const [order, field] of quoteFields.entries()) {
    await prisma.formField.upsert({
      where: { formId_name: { formId: quote.id, name: field.name } },
      create: {
        formId: quote.id,
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.required ?? false,
        helpText: field.helpText ?? null,
        options: field.options ?? undefined,
        halfWidth: field.halfWidth ?? true,
        showWhen: field.showWhen ?? null,
        step: field.step,
        stepTitle: field.stepTitle ?? null,
        order,
      },
      update: {
        label: field.label,
        type: field.type,
        required: field.required ?? false,
        step: field.step,
        stepTitle: field.stepTitle ?? null,
        order,
      },
    })
  }

  const contact = await prisma.form.upsert({
    where: { slug: 'contact' },
    create: {
      slug: 'contact',
      name: 'Send us a message',
      description: 'General enquiries. For a tour quote, use the quote request form — it captures what we need.',
      submitLabel: 'Send message',
      successTitle: 'Message received',
      successBody: 'Thanks — we will reply as soon as we can. For anything urgent, call 855 734 5700.',
      notifyEmail: process.env.FORM_NOTIFY_EMAIL || 'info@knightscoaches.com',
      enabled: true,
    },
    update: {},
  })

  const contactFields = [
    { name: 'name', label: 'Name', type: 'TEXT' as const, required: true, halfWidth: true },
    { name: 'email', label: 'Email', type: 'EMAIL' as const, required: true, halfWidth: true },
    { name: 'phone', label: 'Phone number', type: 'TEL' as const, required: false, halfWidth: true },
    { name: 'subject', label: 'Subject', type: 'TEXT' as const, required: false, halfWidth: true },
    { name: 'message', label: 'Message', type: 'TEXTAREA' as const, required: true, halfWidth: false },
  ]

  for (const [order, field] of contactFields.entries()) {
    await prisma.formField.upsert({
      where: { formId_name: { formId: contact.id, name: field.name } },
      create: {
        formId: contact.id,
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.required,
        halfWidth: field.halfWidth,
        order,
      },
      update: { label: field.label, required: field.required, order },
    })
  }

  console.log('  forms           2 (quote-request, contact)')
}

// ---------------------------------------------------------------------------
// Menus
//
// One canonical URL per topic. The live WordPress footer linked to both
// /entertainer-coach/leasing and /entertainer-coach-rental/leasing, and to both
// /tour-bus-rental/nationwide and /nationwide-tour-bus-rentals. The duplicates
// are 301s; only the canonical route appears here.
// ---------------------------------------------------------------------------

async function seedMenus(): Promise<void> {
  const header = await prisma.menu.upsert({
    where: { slug: 'header' },
    create: { slug: 'header', name: 'Header menu', location: 'HEADER' },
    update: {},
  })
  await prisma.menuItem.deleteMany({ where: { menuId: header.id } })

  const headerItems = [
    { label: 'Home', url: '/' },
    { label: 'About Us', url: '/about-us' },
    { label: 'Fleet', url: '/fleet' },
    { label: 'Entertainer Coach', url: '/entertainer-coach' },
    { label: 'Tour Bus Rental', url: '/tour-bus-rental' },
    { label: 'Nationwide', url: '/tour-bus-rental/nationwide' },
    { label: 'Blog', url: '/blog' },
    { label: 'Contact Us', url: '/contact-us' },
  ]
  for (const [order, item] of headerItems.entries()) {
    await prisma.menuItem.create({
      data: { menuId: header.id, kind: 'PAGE', label: item.label, url: item.url, order },
    })
  }

  const footer = await prisma.menu.upsert({
    where: { slug: 'footer' },
    create: { slug: 'footer', name: 'Footer menu', location: 'FOOTER' },
    update: {},
  })
  await prisma.menuItem.deleteMany({ where: { menuId: footer.id } })

  const columns: { heading: string; links: { label: string; url: string }[] }[] = [
    {
      heading: 'Quick links',
      links: [
        { label: 'Home', url: '/' },
        { label: 'About Us', url: '/about-us' },
        { label: 'Fleet', url: '/fleet' },
        { label: 'Blog', url: '/blog' },
        { label: 'Contact', url: '/contact-us' },
      ],
    },
    {
      heading: 'Services',
      links: [
        { label: 'Entertainer coach rental', url: '/entertainer-coach' },
        // Canonical leasing URL. /entertainer-coach-rental/leasing 301s here.
        { label: 'Coach leasing', url: '/entertainer-coach/leasing' },
        { label: 'Tour bus rental', url: '/tour-bus-rental' },
        // Canonical nationwide URL. /nationwide-tour-bus-rentals 301s here.
        { label: 'Nationwide coverage', url: '/tour-bus-rental/nationwide' },
        { label: 'Tour trucking', url: '/tour-trucking' },
      ],
    },
  ]

  let order = 0
  for (const [index, column] of columns.entries()) {
    const parent = await prisma.menuItem.create({
      data: {
        menuId: footer.id,
        kind: 'CUSTOM',
        label: column.heading,
        url: '#',
        column: index + 1,
        order: order++,
      },
    })
    for (const link of column.links) {
      await prisma.menuItem.create({
        data: {
          menuId: footer.id,
          parentId: parent.id,
          kind: 'PAGE',
          label: link.label,
          url: link.url,
          column: index + 1,
          order: order++,
        },
      })
    }
  }

  console.log('  menus           header (8), footer (2 columns)')
}

main()
  .catch((error) => {
    console.error('\n  Seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
