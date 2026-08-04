import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader } from '@/components/admin/ui'
import { Inbox } from '@/components/admin/inbox'

export const dynamic = 'force-dynamic'

export default async function InboxAdmin({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const gate = await requireRole('EDITOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const { q, filter } = await searchParams

  const [messages, submissions] = await Promise.all([
    prisma.contactMessage
      .findMany({
        where: {
          ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { message: { contains: q } }] } : {}),
          ...(filter === 'unread' ? { read: false } : filter === 'starred' ? { starred: true } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      .catch(() => []),
    prisma.formSubmission
      .findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { form: { select: { name: true } } } })
      .catch(() => []),
  ])

  return (
    <>
      <AdminPageHeader
        title="Inbox"
        description="Every submission is stored in MySQL whether or not the notification email was delivered, so a mail outage never loses a lead."
      />
      <Inbox
        messages={messages.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          phone: m.phone,
          subject: m.subject,
          message: m.message,
          read: m.read,
          starred: m.starred,
          createdAt: m.createdAt.toISOString(),
        }))}
        submissions={submissions.map((s) => ({
          id: s.id,
          formName: s.form.name,
          data: s.data as Record<string, string>,
          emailed: s.emailed,
          emailError: s.emailError,
          createdAt: s.createdAt.toISOString(),
        }))}
        query={q ?? ''}
        filter={filter ?? 'all'}
      />
    </>
  )
}
