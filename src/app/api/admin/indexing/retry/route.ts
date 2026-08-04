import { guard, ok, parseBody } from '@/lib/api'
import { indexingRetrySchema } from '@/lib/admin-schemas'
import { retryFailed } from '@/lib/indexing'

export const runtime = 'nodejs'

/** Re-submits failed indexing rows. */
export async function POST(request: Request): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const body = await parseBody(request, indexingRetrySchema)
  if (!body.ok) return body.response

  return ok(await retryFailed(body.data.ids))
}
