import { prisma } from '@/lib/prisma'
import { guard } from '@/lib/api'

export const runtime = 'nodejs'

/** CSV export of every form submission, one column per distinct field label. */
export async function GET(): Promise<Response> {
  const gate = await guard('EDITOR')
  if (!gate.ok) return gate.response

  const submissions = await prisma.formSubmission.findMany({
    orderBy: { createdAt: 'desc' },
    include: { form: { select: { name: true } } },
  })

  const columns = new Set<string>()
  for (const submission of submissions) {
    for (const key of Object.keys(submission.data as Record<string, string>)) columns.add(key)
  }
  const headers = ['Received', 'Form', 'Email delivered', ...columns]

  const escape = (value: string): string => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

  const rows = submissions.map((submission) => {
    const data = submission.data as Record<string, string>
    return [
      submission.createdAt.toISOString(),
      submission.form.name,
      submission.emailed ? 'yes' : 'no',
      ...[...columns].map((column) => data[column] ?? ''),
    ]
      .map(escape)
      .join(',')
  })

  return new Response([headers.map(escape).join(','), ...rows].join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="knightscoaches-submissions.csv"',
    },
  })
}
