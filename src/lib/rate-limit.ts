/**
 * In-process sliding-window rate limiter for public form endpoints.
 *
 * Deliberately simple: it is a speed bump for casual abuse alongside the
 * honeypot and optional Turnstile check, not a distributed quota. On a
 * multi-instance deployment, move this to Redis — noted in the README.
 */

const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS = 5

const hits = new Map<string, number[]>()

export function checkRateLimit(key: string, max = MAX_REQUESTS, windowMs = WINDOW_MS): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)

  if (recent.length >= max) {
    const oldest = recent[0]
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - oldest)) / 1000) }
  }

  recent.push(now)
  hits.set(key, recent)

  // Opportunistic cleanup so the map cannot grow without bound.
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (!times.some((t) => now - t < windowMs)) hits.delete(k)
    }
  }

  return { ok: true, retryAfter: 0 }
}

export function clientIp(request: Request): string {
  const headers = request.headers
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers.get('x-real-ip') ?? 'unknown'
}

/** Verifies a Cloudflare Turnstile token when a secret is configured. */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (!token) return false
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    })
    const body = (await res.json()) as { success?: boolean }
    return body.success === true
  } catch {
    return false
  }
}
