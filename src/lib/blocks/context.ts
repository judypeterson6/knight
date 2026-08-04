/**
 * Request-scoped context handed to every block renderer.
 *
 * `searchParams` is what makes the fleet filters real: the filter form submits
 * with method="get", the block reads the query string here, and the database
 * query narrows accordingly. A filter that does not change the output would be
 * a spam-policy problem, not a UX flaw.
 */
export interface BlockContext {
  /** Route path of the page being rendered, e.g. '/fleet'. */
  route: string
  searchParams?: Record<string, string | string[] | undefined>
  /** Slug to exclude from RelatedPosts when rendering inside a blog post. */
  currentPostSlug?: string
  /** Category to prefer when picking related posts. */
  currentCategorySlug?: string
}
