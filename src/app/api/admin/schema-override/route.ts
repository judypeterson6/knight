import { prisma } from '@/lib/prisma'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { schemaOverrideSchema } from '@/lib/admin-schemas'
import { prune } from '@/lib/schema-org'
import { revalidateStructuredContent } from '@/lib/revalidate'
import type { EntityType } from '@prisma/client'

export const runtime = 'nodejs'

const ENTITY_TYPES = ['PAGE', 'POST', 'COACH', 'CATEGORY', 'LOCATION'] as const

function parseEntityType(value: string | null): EntityType | null {
  return value && (ENTITY_TYPES as readonly string[]).includes(value) ? (value as EntityType) : null
}

/** Reads the raw JSON-LD override for one entity. */
export async function GET(request: Request): Promise<Response> {
  const gate = await guard('EDITOR')
  if (!gate.ok) return gate.response

  const url = new URL(request.url)
  const entityType = parseEntityType(url.searchParams.get('entityType'))
  const entityId = url.searchParams.get('entityId')
  if (!entityType || !entityId) return fail('entityType and entityId are required')

  const override = await prisma.schemaOverride
    .findUnique({ where: { entityType_entityId: { entityType, entityId } } })
    .catch(() => null)

  return ok(override)
}

/**
 * Saves a raw JSON-LD override.
 *
 * `replace: false` appends the supplied node(s) to the generated @graph;
 * `replace: true` suppresses the generated graph entirely for this entity.
 * The payload is pruned the same way generated nodes are, so an override can
 * never introduce the empty or null properties the rest of the output avoids.
 */
export async function PUT(request: Request): Promise<Response> {
  const gate = await guard('EDITOR')
  if (!gate.ok) return gate.response

  const body = await parseBody(request, schemaOverrideSchema)
  if (!body.ok) return body.response

  const { entityType, entityId, jsonLd, replace, enabled } = body.data

  // Must be a JSON-LD node or an array of them, each with an @type.
  const nodes = Array.isArray(jsonLd) ? jsonLd : [jsonLd]
  if (!nodes.length) return fail('Supply at least one JSON-LD node.', 422)
  for (const node of nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return fail('Each JSON-LD entry must be an object.', 422)
    }
    if (!('@type' in (node as Record<string, unknown>))) {
      return fail('Each JSON-LD entry needs an "@type" property.', 422)
    }
  }

  const cleaned = prune(nodes)
  if (!cleaned) return fail('The supplied JSON-LD is empty once null and blank values are removed.', 422)

  const data = { jsonLd: (Array.isArray(jsonLd) ? cleaned : cleaned[0]) as object, replace, enabled }

  const override = await prisma.schemaOverride.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: { entityType, entityId, ...data },
    update: data,
  })

  revalidateStructuredContent()
  return ok(override)
}

/** Removes the override so the generated graph applies again. */
export async function DELETE(request: Request): Promise<Response> {
  const gate = await guard('EDITOR')
  if (!gate.ok) return gate.response

  const url = new URL(request.url)
  const entityType = parseEntityType(url.searchParams.get('entityType'))
  const entityId = url.searchParams.get('entityId')
  if (!entityType || !entityId) return fail('entityType and entityId are required')

  await prisma.schemaOverride
    .delete({ where: { entityType_entityId: { entityType, entityId } } })
    .catch(() => null)

  revalidateStructuredContent()
  return ok({ entityType, entityId })
}
