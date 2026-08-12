'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Background video for the hero.
 *
 * Three things this handles that a bare <video autoplay> does not:
 *
 * Reduced motion. A looping background is exactly the kind of movement
 * `prefers-reduced-motion` exists to suppress, and CSS cannot stop autoplay.
 * When the preference is set the video never loads and the poster image stays,
 * which is the same picture without the motion.
 *
 * Largest contentful paint. The poster is already the hero image, rendered
 * behind this by next/image with priority. Loading the video eagerly would put
 * tens of megabytes on the critical path for decoration, so it waits until the
 * page is interactive and only then attaches the source.
 *
 * Failure. If the file 404s or the codec is unsupported the element hides
 * itself and the poster image behind it is what shows, rather than a black box.
 */
export function HeroVideo({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [active, setActive] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Wait for idle so the video never competes with the hero image or the
    // quote form for bandwidth on first paint.
    const start = () => setActive(true)
    const idle = window.requestIdleCallback?.(start, { timeout: 2500 })
    const timer = idle === undefined ? window.setTimeout(start, 1200) : undefined

    return () => {
      if (idle !== undefined) window.cancelIdleCallback?.(idle)
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (active) ref.current?.play().catch(() => setFailed(true))
  }, [active])

  if (failed) return null

  const type = /\.webm$/i.test(src) ? 'video/webm' : 'video/mp4'

  return (
    <video
      ref={ref}
      className="absolute inset-0 -z-10 h-full w-full object-cover"
      muted
      loop
      playsInline
      preload="none"
      poster={poster || undefined}
      aria-hidden
      tabIndex={-1}
      onError={() => setFailed(true)}
    >
      {active ? <source src={src} type={type} /> : null}
    </video>
  )
}
