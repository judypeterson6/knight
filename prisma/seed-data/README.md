# Migration snapshot

Everything in this directory is **generated**, not hand-written. It is the output
of `npm run migrate:wp`, which reads https://knightscoaches.com through the
WordPress REST API and writes the content here for `prisma/seed.ts` to consume.

| File | Contents |
| --- | --- |
| `pages.json` | Every migrated page: route, title, full body HTML, an ordered `outline` of the h1–h4 / paragraph / list structure, referenced images, and the per-URL SEO record. |
| `posts.json` | Blog posts with body, excerpt, category and featured image. |
| `categories.json` | Blog categories. No tags — the blog is categories-only by design. |
| `media.json` | Every downloaded asset: local path, original WordPress URL, alt text, caption, intrinsic width/height. |
| `coaches.json` | The fleet as structured records rather than prose. |
| `locations.json` | City pages as `Location` records. |
| `testimonials.json` | Published reviews with a real named author. |
| `redirects.json` | Every old URL that changed shape, plus the duplicate-topic consolidations. |
| `migration-report.json` | Counts, failures and warnings from the last run. |

The snapshot **is committed** so a fresh clone can run
`prisma migrate deploy && prisma db seed` with no network access. Re-run
`npm run migrate:wp` to refresh it from the live site; the script is idempotent
and carries WordPress ids through, so a re-run updates rather than duplicates.

The matching binaries live in `/public/uploads/<year>/<month>/`, which is also
committed for the same reason.
