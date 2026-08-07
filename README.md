# knightscoaches.com

Next.js 15 + React 19 + MySQL rebuild of the WordPress/Elementor site at
https://knightscoaches.com. Entertainer coach rental — a national service
business, not a tool site.

---

## Quick start

```bash
npm install

docker compose up -d          # MySQL 8 on localhost:3306
cp .env.example .env          # DATABASE_URL already matches the compose file

npx prisma migrate deploy     # or: npx prisma migrate dev
npx prisma db seed            # real migrated content — no placeholder copy

npm run dev                   # http://localhost:3000
```

Sign in to the admin at `/admin/login` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`
from `.env`. **Change `ADMIN_PASSWORD` before deploying** — the default value is
a placeholder and the seed will use it verbatim.

To refresh the content from the live WordPress site:

```bash
npm run migrate:wp            # writes prisma/seed-data/ and public/uploads/
npm run verify                # schema + snapshot smoke test, no DB needed
npx prisma db seed
```

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` then `next build` |
| `npm run start` | Production server |
| `npm run lint` | ESLint (flat config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify` | Block-schema and migration-snapshot checks, no database required |
| `npm run migrate:wp` | Re-run the WordPress migration |
| `npm run db:seed` | Seed from `prisma/seed-data/` |
| `npm run db:studio` | Prisma Studio |

---

## Verification status

Run in this environment, all passing:

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 0 warnings |
| `npm run build` | exit 0, compiled successfully |
| `npm run verify` | 20 block schemas, 44 pages, 916 media files on disk, 11 redirects, **47 page templates composed, 731 blocks validated**, 26 internal link targets — 0 failures |
| `npm run migrate:wp` | 44 pages, 5 posts, 916 images, **0 image failures** |

### End-to-end, against the real production MariaDB

`prisma migrate deploy` and `prisma db seed` have both been run against the live
Hostinger database (`srv1167.hstgr.io`, MariaDB), and the site was then served
from it and asserted against. All 21 tables created; the seed reported:

```
settings 9 · admin user · media 916 · coaches 6 in 3 classes · locations 20
testimonials 4 · faq items 40 · posts 5 · forms 2 · pages 47 · menus · redirects 11
```

The app was then served and 15 routes fetched and asserted against. All passed:

| Checked on real rendered HTML | Result |
| --- | --- |
| Exactly one `<h1>` per page | 15/15 |
| No skipped heading levels | 15/15 |
| `<header> <main> <footer> <nav>` present | 15/15 |
| Phone as a real `tel:` link | 15/15 |
| Every `<img>` carries `alt` | 15/15 |
| **No `href="#"` anywhere** — no dead "Book Now" | 15/15 |
| JSON-LD valid, no null or empty properties | 15/15 |
| Canonical + meta description present | 15/15 |
| **No `meta keywords` emitted** | 15/15 |
| FAQ answers in the *initial* HTML | pass |
| Coach specs as crawlable text plus a `<table>` | pass |
| Coverage states as text, not only SVG | pass |
| **Fleet filter genuinely narrows** (`?class=elite`) | 24 → 12 links |
| 301s fire: trailing slash, duplicate topic, `/guides/*` | 3/3 |
| `/sitemap.xml`, `/sitemap-*.xml`, `/robots.txt` serve | 4/4 |
| `/admin` redirects to login when signed out | pass |
| **No edit-toolbar markup for anonymous visitors** | pass |

Getting to that point caught three genuine blockers, each of which would have
stopped a first-time deploy dead:

1. **`import 'server-only'` reached the seed.** `prisma/seed.ts` imported from
   `settings.ts`, which begins `import 'server-only'` — a package that only
   resolves inside Next's bundler. `npx prisma db seed` failed on the very first
   command. The schemas, types and defaults now live in
   `src/lib/settings-defaults.ts`, which carries no `server-only` marker.
2. **A UTF-8 BOM in `migration_lock.toml`.** Prisma could not read the provider
   and aborted with `P3019`, refusing to run any migration.
3. **A UTF-8 BOM in `migration.sql`.** MariaDB rejected query 1 with a syntax
   error at `﻿-- CreateTable`. Ten committed files had picked up BOMs from
   PowerShell redirects; all are stripped, and the two that mattered are fixed.

If you regenerate either file on Windows, write it as **UTF-8 without BOM** —
`Out-File`/`>` in PowerShell adds one and will reintroduce both failures.

Note the server is **MariaDB**, not stock MySQL. Prisma's `mysql` provider
handles it, and the full schema — `LongText`, `VarChar(n)`, the nine native
enums, every unique constraint and cascade — applied without modification.

To shrink that gap as far as possible, all page composition was extracted into
`prisma/seed-blocks.ts` as **pure functions** — snapshot in, block list out, no
Prisma and no filesystem. `npm run verify` then runs every builder the seed will
run, against the real migration snapshot, and checks the result:

- all 47 page templates compose without throwing
- all 731 resulting blocks re-parse against their own Zod schema
- **exactly one `<h1>` block per page** (the source pages carried two or three)
- the alt-text gate passes on every block, the same check the write API applies
- all 26 distinct internal link targets resolve to a route the seed creates —
  so there are no dead CTAs
- every one of the 916 media files referenced by the snapshot exists on disk
- every redirect target resolves, with no self-references or loops

What remains unproven is the Prisma write calls themselves. Run
`docker compose up -d` and the two Prisma commands first; if anything fails it
will be there, not in the content.

This already caught one real defect: the `image` and `cta` sub-schemas had no
default, so inserting a fresh block in the page builder would have thrown.

`npm run build` also runs cleanly *without* a database, because every data
function catches connection errors — but the generated `sitemap*.xml` would then
be empty for up to an hour. **Build with `DATABASE_URL` reachable.**

---

## Decisions made (and why)

These were judgement calls made without asking, as instructed.

**1. The design source overrides the visual spec — with one deliberate exception.**
The supplied Claude Design project (`Knights Coaches.dc.html` and siblings) is
the visual authority: colours `#eb6e2c` / `#14110e` / `#faf8f5`, Montserrat,
1300px container, pill buttons, 20px card radius, the eyebrow-with-rules pattern,
the split FAQ layout. All of it is reproduced as theme tokens.

The exception is the homepage hero. The design has a full-viewport video hero
whose primary CTA is `#quote` — a button that scrolls down to content further
down the same page. The Visual Semantics brief explicitly forbids exactly that.
Resolution: the hero keeps the design's video background, badge, H1, statement
and trust stats, but the action block is a **real inline quote form**, in-viewport,
next to the H1, with the phone number as a real `<a href="tel:">`. Nothing scrolls
to reach the centerpiece.

**2. The coverage map is an inline SVG tile cartogram, not the design's iframe.**
The design loads d3 + topojson from a CDN inside an `<iframe>`. That is a
third-party request on the critical path, a layout-shift source, and invisible
without JavaScript. It is replaced with a self-contained SVG cartogram
(`src/components/ui/us-coverage-map.tsx`). The map is `aria-hidden` either way —
the authoritative state and city lists render beside it as real `<a>` links,
which is what the brief actually requires.

**3. Coach prices are null, not invented.**
The live site publishes a fleet-wide "$180 to $320 depending on which unit fits
the crew size" band on the nationwide page, and **no per-coach price anywhere**.
Splitting that band into six specific numbers would be fabricating data. So
`dailyPrice` is null for every seeded coach, and three things follow automatically:
cards read "Quoted per tour", the `Product` schema omits `offers`, and **the price
filter does not render on /fleet at all** until at least one coach has a real rate.
A filter that cannot change the result set has no business being on the page. Set
real rates in `/admin/fleet` and all three activate.

**4. The fleet has no per-coach source pages, so specs come from the design.**
The live `/fleet` renders Elementor cards whose "View Details" buttons link to `#`.
There is no per-coach WordPress page to migrate, so there is no source body copy.
The six coaches are seeded from the specs the source *does* publish — name, class,
chassis, bunk count, slide-out and rear configuration, gallery image — as confirmed
by the design files. Every card now links to a real `/fleet/[slug]` page. This is
the one place where content did not come from the migration, and it is marked as
such in `scripts/migrate-wordpress.ts`.

**5. Legal pages describe this application, accurately.**
The source site publishes no privacy policy, terms or disclaimer, but the brief
lists all three as routes and forbids placeholder text. They are written to
describe what this app actually does: which form fields are stored, where, for
how long, that the only cookie is the admin session, and that any analytics
script listed in settings is a third party. **Have counsel review before launch** —
they are accurate as built, not legal advice.

**6. Blog posts live at `/guides/` on the source.**
The migration found the 5 posts under `/guides/<slug>/`, not `/blog/`. They are
migrated to `/blog/<slug>` per the route table, with 301s from `/guides/*`.

**7. Rate limiting is in-process.**
`src/lib/rate-limit.ts` is a single-instance sliding window — a speed bump
alongside the honeypot and optional Turnstile, not a distributed quota. Move it to
Redis before running more than one instance.

---

## Content migration

`scripts/migrate-wordpress.ts` reads the live site and writes a snapshot that
`prisma/seed.ts` consumes. Both the snapshot (`prisma/seed-data/`) and the
downloaded media (`public/uploads/`) are **committed**, so a fresh clone can seed
with no network access.

The last run:

```
discovery method      rest
pages found           44
pages migrated        44
posts migrated        5 of 5
categories migrated   1
images downloaded     916
images failed         0
coaches extracted     6
locations extracted   20
testimonials          4
redirects created     11
```

It tries `/wp-json/wp/v2/` first (paginated at `per_page=100` via
`X-WP-TotalPages`) and falls back to crawling `/sitemap_index.xml` and parsing
rendered HTML if REST is disabled. It cross-checks REST against the sitemap either
way. Per-URL SEO comes from `yoast_head_json` where present, otherwise from
parsing the rendered `<head>`. **`meta keywords` is deliberately never read** — it
has no column, no admin field, and is not emitted anywhere.

### Duplicate URLs found and consolidated

The live footer linked to two different leasing URLs and two different nationwide
URLs. One canonical route was chosen per topic; every other spelling is a 301 and
the seeded footer menu points only at the canonical one.

| Duplicate | 301s to |
| --- | --- |
| `/entertainer-coach-rental/leasing/` | `/entertainer-coach/leasing` |
| `/entertainer-coach-rental/` | `/entertainer-coach` |
| `/nationwide-tour-bus-rentals/` | `/tour-bus-rental/nationwide` |
| `/nationwide-tour-bus-rental/` | `/tour-bus-rental/nationwide` |
| `/entertainer-coach/leasing-2/` | `/entertainer-coach/leasing` |
| `/tour-bus-rental/nationwide-2/` | `/tour-bus-rental/nationwide` |

---

## Old URL → new route checklist

Every URL below resolves — same path, or a 301 through the `Redirect` table
(applied in `src/middleware.ts`). Trailing slashes are normalised with a 301, so
the WordPress form of every URL keeps working.

### Named in the brief

| Old URL | New route | How |
| --- | --- | --- |
| `/` | `/` | same |
| `/about-us/` | `/about-us` | 301 (slash) |
| `/entertainer-coach/` | `/entertainer-coach` | 301 (slash) |
| `/entertainer-coach/leasing/` | `/entertainer-coach/leasing` | 301 (slash) |
| `/entertainer-coach-rental/leasing/` | `/entertainer-coach/leasing` | 301 |
| `/tour-bus-rental/` | `/tour-bus-rental` | 301 (slash) |
| `/tour-bus-rental/nationwide/` | `/tour-bus-rental/nationwide` | 301 (slash) |
| `/nationwide-tour-bus-rentals/` | `/tour-bus-rental/nationwide` | 301 |
| `/fleet/` | `/fleet` | 301 (slash) |
| `/contact-us/` | `/contact-us` | 301 (slash) |
| blog posts | `/blog/[slug]` | 301 from `/guides/[slug]/` |
| blog categories | `/blog/category/[slug]` | same |

### Found in the sitemap but **not** in the brief

The brief said to verify against the sitemap rather than assume its list was
complete. It was not — there are 32 further pages, all migrated:

**20 city pages** under `/tour-bus-rental/`: `atlanta-ga`, `austin-tx`,
`baltimore-md`, `boston-ma`, `branson-mo`, `chicago-il`, `denver-co`,
`detroit-mi`, `houston-tx`, `las-vegas-nv`, `los-angeles`, `miami-fl`,
`minneapolis-mn`, `nyc`, `oklahoma-city`, `philadelphia-pa`, `phoenix-az`,
`san-francisco-ca`, `seattle-wa`, `washington-dc`.

**12 audience/service pages** under `/entertainer-coach/`: `band`,
`christian-gospel-music`, `country-music`, `dj`, `hip-hop-artist`, `latin-music`,
`long-term`, `musician`, `pop-artist`, `rock-band`, `short-term`, `solo-artist`,
`vip-charter`, `wraps`.

**Plus** `/tour-trucking/` and `/tour-bus-rental/driver/`.

### New routes

`/fleet/[slug]` (6 coaches), `/blog`, `/blog/[slug]`, `/blog/category/[slug]`,
`/privacy-policy`, `/terms`, `/disclaimer`, `/sitemap`, `/sitemap.xml`,
`/sitemap-{pages,posts,categories,fleet}.xml`, `/robots.txt`.

---

## Architecture

```
prisma/
  schema.prisma            21 models, MySQL
  migrations/              committed, generated with `prisma migrate diff`
  seed.ts                  database writes
  seed-blocks.ts           page composition as pure functions — testable, no DB
  seed-data/               migration output (committed)
scripts/
  migrate-wordpress.ts     WP REST / sitemap crawl, media, SEO, redirects
  verify-content.ts        runs every page builder and validates every block
src/
  app/
    (site)/                public site
      [[...slug]]/         every DB-backed page renders here
      fleet/[slug]/        coach detail
      blog/                archive, post, category
    admin/                 the panel
    api/admin/             guarded, Zod-validated mutations
    sitemap*.xml/          generated sitemaps
  components/
    blocks/                the 20 block renderers
    ui/                    primitives, icons, coverage map
    site/                  header, footer, mobile nav
    admin/                 builder, editors, managers
    forms/                 public form client
  lib/
    blocks/                schemas, registry, request context
    settings.ts            typed DB-backed settings with defaults
    seo.ts, schema-org.ts, sitemap.ts, indexing.ts
    auth.ts, crud.ts, api.ts, revalidate.ts
```

### Nothing hardcoded in JSX

Every heading, paragraph, button label, list item, FAQ, stat, testimonial, meta
field and image alt is a row in MySQL. Pages are ordered lists of `PageBlock`
rows; each block's `props` JSON is validated against that block's Zod schema on
both write and read. Site-wide strings (business name, phone, address,
certification claims) live in the `Setting` table.

The one place a literal colour is allowed is `src/components/theme-style.tsx`,
which turns the theme settings into CSS custom properties on `:root`. Every
component reads the variables, so `/admin/appearance` restyles the site without
a deploy.

### Semantic HTML and accessibility

- `<header> <nav> <main> <article> <section> <aside> <footer> <figure>
  <figcaption> <address> <time>` throughout; no `<div>` where a landmark exists.
- Exactly one `<h1>` per page. The source pages carried two or three (Elementor);
  the seed collapses them and the block schema pins the heading level per block.
- Every form control has a real `<label>`; every icon sits beside a text label
  and is `aria-hidden`; status regions use `aria-live`.
- Skip link, visible focus ring, keyboard-navigable menus, `prefers-reduced-motion`
  honoured.
- **FAQ answers ship in the initial server-rendered HTML.** The accordion adds
  `html.js` on mount and only then does CSS collapse them — with JavaScript
  disabled every answer is open and readable. Nothing is injected on click.
- Alt text is enforced at the API layer (`requireAlt()` in
  `src/lib/blocks/schema.ts`), not just in the UI. An empty alt is only accepted
  when `decorative` was explicitly ticked.

### Things deliberately not built

No fake progress bars. No dead `Book Now` buttons — every fleet card links to its
real `/fleet/[slug]`. No filter that does not filter (see decision 3). No fake
availability calendar; the availability dot reads the real `available` column. No
scroll-triggered counter as the only source of a number — every stat is text in
the HTML. No ad slot or banner above the `<h1>` inside `<main>`. No tag system.
No keywords field.

---

## Admin

`/admin`, protected by middleware (session cookie), then by the layout (real user
lookup), then by `requireRole()` on **every** mutation. The UI hiding a button is
a convenience, not the control.

| Role | Can |
| --- | --- |
| `ADMIN` | Everything |
| `EDITOR` | All content, media, inbox — not settings, users, redirects, forms |
| `AUTHOR` | Write posts, edit **their own** posts, upload media |

The last active admin cannot be demoted, deactivated or deleted.

**Password reset.** "Forgot your password?" on the login page emails a
single-use link valid for one hour. The token is random, stored only as a
SHA-256 hash, and cleared on use. The request step answers identically whether
or not the address exists, so it cannot be used to enumerate accounts, and it is
rate limited per IP. `/admin/reset-password` is the only route besides
`/admin/login` that the middleware lets through without a session.

**Bulk actions on posts.** Select rows to publish, move to draft, archive,
recategorise or delete. An `AUTHOR` acting on a mixed selection has it narrowed
to their own posts server-side and is told how many were skipped, rather than
having the whole action rejected. Deleting is `EDITOR` and above.

**Media replace.** Swapping the file behind an asset keeps the same row id and
the same public URL, so every page, block, coach gallery and post already
pointing at it picks up the new image. The replacement must share the original's
file extension — the stored path carries it, and changing it would break the
very URL the feature exists to preserve.

### Page builder — `/admin/pages/[id]/edit`

Left rail: the fixed 20-block library, grouped. Centre: the block list with
drag-and-drop reorder, duplicate, delete, show/hide, plus tabs for page settings,
SEO and revision history. Right rail: the selected block's fields, derived from
its live prop values so the editor can never drift from the Zod schema, plus
spacing/background/alignment tokens.

Every save writes a `PageRevision` first (30 kept per page), so every change is
restorable — and restoring snapshots the current state first, so the restore is
itself undoable. Posts get the same treatment: a `PostRevision` is written on
every save and the history, with restore, is in the post editor's sidebar.

### Front-end live editing

A signed-in admin or editor viewing any public page gets a toolbar. Toggling edit
mode makes headings and paragraphs inline-editable in place on the real rendered
element; a side drawer reorders and hides blocks. Saving goes through the same
`PageBlock` API — same validation, same revisioning — then revalidates.

For an anonymous visitor `EditToolbarGate` returns `null` on the server, so the
toolbar's client component is never referenced and **none of its JavaScript is in
the page bundle**.

### Adding a block type

1. Add the props schema to `blockSchemas` in `src/lib/blocks/schema.ts`. Use
   `imageField` / `ctaField` for image and CTA properties — the plain `image` and
   `cta` objects have no default and will throw on an empty props object.
2. Add an entry to `BLOCK_META` in `src/lib/blocks/registry.ts` (label,
   description, category, whether it reads its own rows from the DB).
3. Write the component in the matching file under `src/components/blocks/`
   (`hero`, `content`, `proof`, `fleet`, `geo`, `interactive`) and add a `case` to
   the switch in `src/components/blocks/index.tsx`.
4. `npm run verify` — it will fail if the schema cannot parse its own defaults.

The admin inspector needs no changes: it renders fields from the parsed props.

---

## SEO

- **Per-URL metadata** with global fallbacks. Title template `%page% | %site%`.
- **No keywords field** anywhere — schema, admin, or `<head>`.
- **Sitemaps**: `/sitemap.xml` index plus one child per type. `lastmod`,
  `changefreq`, `priority`; per-item exclude; `noindex` implies exclusion.
- **`robots.txt`** editable in `/admin/seo`, defaults to disallowing `/admin`
  and `/api/` and pointing at the sitemap index.
- **Redirects**: `Redirect` table, pre-populated by the migration, CSV
  import/export, hit counters. Applied in middleware, which delegates the lookup
  to a cached Node-runtime route because the edge cannot open a MySQL connection.
- **Audit** at `/admin/seo/audit`: missing meta descriptions, duplicate titles,
  over-length titles, images without alt text, broken internal links (searched
  through block props JSON), orphan pages, thin post excerpts.

### JSON-LD

Site-wide `Organization`, `WebSite` with `SearchAction`, `LocalBusiness` with the
National Harbor address. Per type: `Service` + `BreadcrumbList` + `FAQPage` on
service and location pages; `Product`/`Vehicle` with `offers` on coach detail;
`BlogPosting` on posts; `WebPage`/`AboutPage`/`ContactPage`/`CollectionPage`
elsewhere. A per-entity raw JSON-LD override can augment or replace the graph.

`prune()` strips every null, empty string and empty array before output, so no
empty property is ever emitted. **`Review` is nested on `Organization` only where
a real named review exists, and `AggregateRating` is never synthesised** — the
business has no verified rating count to publish.

**Raw JSON-LD override** per page, post and coach, in the SEO panel of each
editor. Anything entered there is appended to the generated graph; a "replace"
toggle suppresses the generated graph entirely for that entity. The override is
validated as JSON, required to carry an `@type`, and run through the same
`prune()` as generated nodes, so it cannot introduce empty properties. Do not
include `@context` — it is added for you.

FAQ schema is generated from the same `FaqItem` rows the accordion renders, so
the markup and the structured data cannot drift apart.

### Indexing

- **IndexNow** — key file served at `/{INDEXNOW_KEY}.txt` by middleware, changed
  URLs POSTed on publish. This works today.
- **Google Indexing API** — wired up with a service account. **Note the real
  limitation:** Google officially restricts this API to `JobPosting` and
  `BroadcastEvent`. Submissions for service, fleet and blog URLs are generally
  accepted then ignored. The XML sitemap plus Search Console remains the primary
  path to indexation for this site. This is stated in the admin UI too.
- Sitemap ping on publish; manual and bulk submit at `/admin/seo/indexing`;
  `IndexingLog` with retry and a daily quota counter.

---

## Forms

Two seeded forms (`quote-request`, `contact`), fully configurable at
`/admin/forms` — label, type, required, options, conditional visibility, half/full
width, and **step grouping**. **Validation on the public endpoint is generated
from the same rows**, so the rules always match what the visitor was shown.

**Multi-step.** Seventeen fields on one page is a wall, so the quote form
paginates into four short steps — Your tour, Your details, Coaches, Trucking and
notes. Steps live on the field (`step` + `stepTitle`), so an editor regroups them
in `/admin/forms` without a deploy; leaving every field on step 1 renders a
single-page form, which is what the contact form does.

The step indicator reflects real position and **"Next" refuses to advance while a
required field on the current step is empty** — the progress shown is never ahead
of what has actually been filled in. Focus moves to the new step's heading on
advance, and step changes and validation errors are announced through an
aria-live region. A conditional field must sit on the same step as the checkbox
that reveals it; the API rejects a cross-step dependency, because otherwise the
trigger sits on a page the visitor has already left.

> **After seeding, clear the Next data cache.** `prisma db seed` is a script, so
> it cannot call `revalidateTag`. Form and page data stay cached for up to an hour
> and your changes will not appear. Delete `.next/cache` (or restart with a clean
> build) after any seed. Editing through `/admin` does not have this problem —
> those writes revalidate properly.

Protection: honeypot, in-process rate limit, optional Cloudflare Turnstile.
**Submissions are written to MySQL before the notification email is attempted**,
and the delivery result is recorded on the row — a mail outage never loses a lead.
The inbox shows delivery status and exports to CSV.

---

## Rendering model

Worth stating exactly, because there is one real trade-off in it.

**No public route uses `force-dynamic`** — only admin screens do. Public routes
are registered as ISR routes (`revalidate = 300`, `dynamicParams = true`) and
every database read goes through `unstable_cache` with tags, invalidated by
`revalidateTag` on save. So content changes propagate immediately and the
database is not queried per request.

The site layout deliberately calls **no dynamic request API of its own**. The
header's active-nav state is resolved client-side from `usePathname()` rather
than `headers()`, and the layout performs no database query at all.

The one dynamic API left on the public path is the session check in
`EditToolbarGate`. That is a deliberate choice: the brief requires that edit mode
"never renders for anonymous visitors and its JS is not shipped to them", and the
only way to guarantee the JavaScript never enters the bundle is to decide on the
server, which means reading the session cookie. The cost is a React render per
request instead of a full-route cache hit; the data behind it is still cached.

If you would rather have the full-route cache and can accept a ~1 KB probe
script for anonymous visitors, delete `EditToolbarGate` from
`src/app/(site)/layout.tsx` and mount `EditToolbar` from a client component that
self-gates against `/api/admin/page-context`. Everything else keeps working —
the block builder at `/admin/pages/[id]/edit` is the primary editing surface
either way.

---

## Performance

- ISR everywhere; `revalidateTag` / `revalidatePath` on save. **No `force-dynamic`
  on any public route** (only admin screens use it). See *Rendering model* above
  for the one dynamic API that remains and why.
- Server components by default. The only client components are the ones that
  genuinely need state: mobile nav, FAQ accordion, forms, and the admin editors.
- `next/font` with `display: swap`, only the selected weights fetched. No
  render-blocking CDN stylesheet.
- Every image goes through `next/image` with explicit `width`/`height` — the
  migration reads intrinsic dimensions from the PNG/JPEG/GIF/WebP headers, so all
  916 assets have real dimensions and CLS stays at zero.
- LCP element is the H1 or the first content image, which is `priority`.
- Font Awesome and the d3 CDN from the design are both gone; icons are
  tree-shaken `lucide-react`.

---

## Deployment

### Vercel

1. Import the repo. Build command `npm run build`, output Next.js (default).
2. Set every variable from `.env.example`. `DATABASE_URL` must point at a MySQL 8
   reachable from Vercel (PlanetScale, RDS, Railway).
3. `npx prisma migrate deploy` as a release step, then `npx prisma db seed` once.
4. `NEXT_PUBLIC_SITE_URL` must be the real origin — canonicals, OG URLs, sitemap
   entries and IndexNow all derive from it.

**Uploads on Vercel:** the filesystem is ephemeral, so `/public/uploads` writes
from the media library do not persist. `src/app/api/admin/media/route.ts` is the
single place that touches disk — swap its `writeFile` for an S3 client and set
`images.remotePatterns` accordingly. Committed migration media is served from the
build and is unaffected.

### Node + MySQL

```bash
npm ci
npx prisma migrate deploy
npx prisma db seed
npm run build
npm run start          # behind nginx/Caddy
```

Here `/public/uploads` is a normal directory and the media library works as-is.
Put it on a volume that survives deploys.

---

## Environment variables

See `.env.example`. Required: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
`NEXT_PUBLIC_SITE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

Optional: `SMTP_*` and `FORM_NOTIFY_EMAIL` (submissions still persist without
them), `INDEXNOW_KEY`, `GOOGLE_INDEXING_SA_JSON`, `TURNSTILE_SECRET_KEY` +
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `WP_SOURCE_URL`.

---

## Known gaps

Stated plainly rather than left to be discovered:

1. **`/sitemap` emits no JSON-LD**, where every other public page does. Harmless
   but inconsistent — add an `organizationNode()` + `webPageNode()` graph to
   `src/app/(site)/sitemap/page.tsx` if you want it uniform.
2. **803 of 916 migrated images have no alt text**, because they had none in
   WordPress. They are flagged in `/admin/seo/audit` and in the media library, and
   they cannot be added to a coach gallery until labelled. This is real content
   debt inherited from the source, surfaced rather than papered over.
3. **`public/uploads` is 249 MB across 916 files, committed to git.** That is
   large for a repository and you may want to change it. Measured: 596 files
   (140 MB) are referenced by migrated page or post content; the other 320
   (108 MB) are not — *but do not simply delete them*. Many of the unreferenced
   ones are genuine page assets (`About-Knights-Coaches-Tour-Bus-Rental-Seattle.jpg`,
   the logo files) that live in Elementor **page meta** rather than in the
   rendered content the REST API returns, so a reference scan cannot see them.
   Over-collecting was the safe error here, given "nothing may be lost". If the
   size matters, the right fixes are Git LFS for `public/uploads/**`, or moving
   media to S3 via the storage swap described under *Deployment*.
4. **Lighthouse was not run** — no browser in the build environment. The
   structural work is done (no CDN requests, explicit image dimensions, server
   components, `display: swap`, priority LCP), but the ≥95 targets are unmeasured.
5. **Coach prices are unset by design** — see decision 3.
6. **Legal pages need counsel review** — see decision 5.
7. **Rate limiting is single-instance** — see decision 7.
