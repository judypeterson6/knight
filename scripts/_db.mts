/**
 * Shared Prisma client for one-off scripts.
 *
 * Every script that opened `new PrismaClient()` directly inherited the pool
 * size from DATABASE_URL, which the running site also uses. The host caps
 * connections per hour rather than concurrently, so a burst of short script
 * runs during a working session exhausts the allowance and the live site
 * starts failing. A single session here ran through 500 several times over.
 *
 * Scripts are sequential and never need more than one connection, so this
 * forces connection_limit=1 regardless of what the environment says. It also
 * guarantees disconnection, including on the error path, so a crashed script
 * does not hold its connection until the server times it out.
 *
 * Usage:
 *
 *   import { withDb } from './_db.mts'
 *   await withDb(async (prisma) => { ... })
 */

import { PrismaClient } from '@prisma/client'

/** Forces a single connection, preserving any other parameters already set. */
function singleConnectionUrl(): string | undefined {
  const raw = process.env.DATABASE_URL
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    url.searchParams.set('connection_limit', '1')
    url.searchParams.set('pool_timeout', '20')
    return url.toString()
  } catch {
    return raw
  }
}

export function createClient(): PrismaClient {
  const datasourceUrl = singleConnectionUrl()
  return new PrismaClient({
    log: ['error'],
    ...(datasourceUrl ? { datasourceUrl } : {}),
  })
}

/**
 * Runs `job` against a client that is always closed afterwards.
 *
 * Returns the job's value. On failure the connection is released before the
 * error propagates, so the script still exits cleanly.
 */
export async function withDb<T>(job: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  const prisma = createClient()
  try {
    return await job(prisma)
  } finally {
    await prisma.$disconnect()
  }
}
