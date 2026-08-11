/**
 * Reports the database's own connection accounting.
 *
 *   npx tsx scripts/db-status.mts
 *
 * The host enforces max_connections_per_hour rather than a concurrent cap, so
 * "it worked a minute ago" says nothing about whether the next request will.
 * This asks the server what the limits are and how much of the allowance the
 * account has already spent, which is the only reliable way to tell whether a
 * failure is a bug or the quota.
 */

import { withDb } from './_db.mts'

interface Row {
  Variable_name?: string
  Value?: string
  [key: string]: unknown
}

await withDb(async (prisma) => {
  const pooled = process.env.DATABASE_URL?.match(/connection_limit=(\d+)/)?.[1]
  console.log(`\n  pool limit in DATABASE_URL : ${pooled ?? 'not set (Prisma default: cpus * 2 + 1)'}`)
  console.log('  this script                : 1 (forced by scripts/_db.mts)')

  // Account-level grants. On shared hosting these are the caps that bite.
  const grants = await prisma
    .$queryRawUnsafe<Row[]>(
      `SELECT max_connections, max_user_connections, max_questions, max_updates
       FROM mysql.user WHERE user = SUBSTRING_INDEX(CURRENT_USER(), '@', 1) LIMIT 1`,
    )
    .catch(() => null)

  if (grants?.length) {
    const g = grants[0]
    console.log('\n  account limits')
    console.log(`    max_connections_per_hour : ${g.max_connections ?? '?'}`)
    console.log(`    max_user_connections     : ${g.max_user_connections ?? '?'}`)
    console.log(`    max_questions_per_hour   : ${g.max_questions ?? '?'}`)
  } else {
    console.log('\n  account limits: not readable (mysql.user needs privileges this account lacks)')
  }

  const threads = await prisma
    .$queryRawUnsafe<Row[]>(`SHOW STATUS WHERE Variable_name IN ('Threads_connected','Connections','Aborted_connects')`)
    .catch(() => null)

  if (threads?.length) {
    console.log('\n  server counters')
    for (const row of threads) console.log(`    ${String(row.Variable_name).padEnd(24)} ${row.Value}`)
  }

  console.log('\n  A "max_connections_per_hour" error is the quota, not a fault in the app.')
  console.log('  It clears on a rolling hour. Restarting the dev server spends more of it.\n')
})
