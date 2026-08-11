import { SmartImage } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

export interface AuthorSummary {
  name: string
  bio: string | null
  avatar: { path: string; alt: string; width: number | null; height: number | null } | null
}

/** First letters of the first two words: "Dan Rowe" -> "DR". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Author avatar, or their initials where no image is set.
 *
 * A missing avatar is common and should not leave a broken frame or a stock
 * silhouette, so the initials stand in. Decorative either way: the name is
 * always adjacent as real text.
 */
export function AuthorAvatar({ author, size = 'md' }: { author: AuthorSummary; size?: 'sm' | 'md' }) {
  const px = size === 'sm' ? 40 : 56
  const box = size === 'sm' ? 'h-10 w-10 text-[0.8rem]' : 'h-14 w-14 text-step-0'

  if (author.avatar) {
    return (
      <SmartImage
        image={{
          src: author.avatar.path,
          alt: '',
          width: author.avatar.width ?? px,
          height: author.avatar.height ?? px,
          caption: '',
          decorative: true,
        }}
        className={cn('flex-shrink-0 rounded-full object-cover', box)}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'flex flex-shrink-0 items-center justify-center rounded-full bg-primary font-extrabold text-primary-contrast',
        box,
      )}
    >
      {initials(author.name)}
    </span>
  )
}

/**
 * The author block that closes an article.
 *
 * Placed after the body rather than above it, so the opening answer is the
 * first thing a reader meets. Renders nothing when there is no bio, because a
 * card containing only a name repeated from the byline is noise.
 */
export function AuthorCard({ author, role }: { author: AuthorSummary; role?: string }) {
  if (!author.bio?.trim()) return null

  return (
    <aside className="mt-14 rounded-block border border-line bg-surface-alt p-7 md:p-8">
      <div className="flex items-start gap-5">
        <AuthorAvatar author={author} />
        <div className="min-w-0">
          <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-subtle">Written by</p>
          <h2 className="mt-1 text-step-1">{author.name}</h2>
          {role ? <p className="mt-0.5 text-step--1 font-semibold text-primary-deep">{role}</p> : null}
          <p className="mt-3 text-step--1 leading-relaxed text-muted">{author.bio}</p>
        </div>
      </div>
    </aside>
  )
}
