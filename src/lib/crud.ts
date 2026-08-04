import 'server-only'
import type { Role } from '@prisma/client'
import type { ZodTypeAny, z } from 'zod'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { requireAlt } from '@/lib/blocks/schema'

/**
 * Thin CRUD factory for the admin API.
 *
 * Every generated handler enforces the role server-side before touching the
 * database, validates the body with Zod, and runs the alt-text gate over any
 * payload that can carry an image. Route files stay one line each.
 */

// The Prisma delegate surface these handlers need. Kept structural rather than
// importing 15 concrete delegate types.
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Delegate {
  findMany: (args?: any) => Promise<any[]>
  findUnique: (args: any) => Promise<any>
  create: (args: any) => Promise<any>
  update: (args: any) => Promise<any>
  delete: (args: any) => Promise<any>
  count: (args?: any) => Promise<number>
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface CrudOptions<C extends ZodTypeAny, U extends ZodTypeAny> {
  delegate: () => Delegate
  createSchema: C
  updateSchema: U
  /** Minimum role for reads and for writes. */
  readRole?: Role
  writeRole?: Role
  /** Prisma `include`/`orderBy` for list and single reads. */
  listArgs?: Record<string, unknown>
  singleArgs?: Record<string, unknown>
  /** Runs after a successful mutation — cache invalidation, indexing, etc. */
  onChange?: (record: Record<string, unknown>, action: 'create' | 'update' | 'delete') => Promise<void> | void
  /** Rejects a delete, e.g. the last remaining admin. */
  canDelete?: (record: Record<string, unknown>) => Promise<string | null>
  /** Transforms a validated body before it reaches Prisma. */
  transform?: (data: Record<string, unknown>, action: 'create' | 'update') => Promise<Record<string, unknown>> | Record<string, unknown>
}

export function createCollectionHandlers<C extends ZodTypeAny, U extends ZodTypeAny>(options: CrudOptions<C, U>) {
  const readRole = options.readRole ?? 'EDITOR'
  const writeRole = options.writeRole ?? 'EDITOR'

  async function GET(): Promise<Response> {
    const gate = await guard(readRole)
    if (!gate.ok) return gate.response
    const rows = await options.delegate().findMany(options.listArgs ?? {})
    return ok(rows)
  }

  async function POST(request: Request): Promise<Response> {
    const gate = await guard(writeRole)
    if (!gate.ok) return gate.response

    const body = await parseBody(request, options.createSchema)
    if (!body.ok) return body.response

    const altErrors = requireAlt(body.data, 'body')
    if (altErrors.length) return fail(altErrors[0], 422, altErrors)

    const data = options.transform
      ? await options.transform(body.data as Record<string, unknown>, 'create')
      : (body.data as Record<string, unknown>)

    try {
      const record = await options.delegate().create({ data })
      await options.onChange?.(record, 'create')
      return ok(record, 201)
    } catch (error) {
      return fail(prismaMessage(error), 409)
    }
  }

  return { GET, POST }
}

export function createItemHandlers<C extends ZodTypeAny, U extends ZodTypeAny>(options: CrudOptions<C, U>) {
  const readRole = options.readRole ?? 'EDITOR'
  const writeRole = options.writeRole ?? 'EDITOR'

  async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
    const gate = await guard(readRole)
    if (!gate.ok) return gate.response
    const { id } = await ctx.params
    const record = await options.delegate().findUnique({ where: { id }, ...(options.singleArgs ?? {}) })
    if (!record) return fail('Not found', 404)
    return ok(record)
  }

  async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
    const gate = await guard(writeRole)
    if (!gate.ok) return gate.response
    const { id } = await ctx.params

    const body = await parseBody(request, options.updateSchema)
    if (!body.ok) return body.response

    const altErrors = requireAlt(body.data, 'body')
    if (altErrors.length) return fail(altErrors[0], 422, altErrors)

    const data = options.transform
      ? await options.transform(body.data as Record<string, unknown>, 'update')
      : (body.data as Record<string, unknown>)

    try {
      const record = await options.delegate().update({ where: { id }, data })
      await options.onChange?.(record, 'update')
      return ok(record)
    } catch (error) {
      return fail(prismaMessage(error), 409)
    }
  }

  async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
    const gate = await guard(writeRole)
    if (!gate.ok) return gate.response
    const { id } = await ctx.params

    const record = await options.delegate().findUnique({ where: { id } })
    if (!record) return fail('Not found', 404)

    if (options.canDelete) {
      const reason = await options.canDelete(record)
      if (reason) return fail(reason, 409)
    }

    try {
      await options.delegate().delete({ where: { id } })
      await options.onChange?.(record, 'delete')
      return ok({ id })
    } catch (error) {
      return fail(prismaMessage(error), 409)
    }
  }

  return { GET, PATCH, DELETE }
}

export function prismaMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('Unique constraint')) {
    const field = /`(\w+)`/.exec(message)?.[1]
    return field ? `That ${field} is already taken.` : 'That value is already taken.'
  }
  if (message.includes('Foreign key constraint')) return 'That record is still referenced elsewhere.'
  if (message.includes("Can't reach database")) return 'Cannot reach the database.'
  return message.split('\n').filter(Boolean).slice(-1)[0] ?? 'Request failed'
}

export type Infer<S extends ZodTypeAny> = z.infer<S>
