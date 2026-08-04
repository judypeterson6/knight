import 'server-only'
import { ZodError, type ZodTypeAny, type z } from 'zod'
import type { Role } from '@prisma/client'
import { requireRole } from '@/lib/auth'

/**
 * Shared plumbing for the admin API routes.
 *
 * Every mutation goes through `guard`, which enforces the role server-side.
 * The admin UI hiding a control is a convenience — this is the actual gate.
 */

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ ok: true, data }, { status })
}

export function fail(error: string, status = 400, details?: unknown): Response {
  return Response.json({ ok: false, error, details }, { status })
}

export async function guard(minimum: Role) {
  const result = await requireRole(minimum)
  if (!result.ok) {
    return { ok: false as const, response: fail(result.error, result.status) }
  }
  return { ok: true as const, user: result.user }
}

export async function parseBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: Response }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, response: fail('Malformed JSON body') }
  }
  try {
    return { ok: true, data: schema.parse(raw) as z.infer<S> }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false,
        response: fail(
          error.errors[0]?.message ?? 'Validation failed',
          422,
          error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
        ),
      }
    }
    return { ok: false, response: fail('Validation failed', 422) }
  }
}
