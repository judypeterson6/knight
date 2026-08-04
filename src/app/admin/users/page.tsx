import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader } from '@/components/admin/ui'
import { UsersManager } from '@/components/admin/users-manager'

export const dynamic = 'force-dynamic'

export default async function UsersAdmin() {
  const gate = await requireRole('ADMIN')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const users = await prisma.user
    .findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, role: true, active: true, bio: true, lastLoginAt: true },
    })
    .catch(() => [])

  const activeAdmins = users.filter((u) => u.role === 'ADMIN' && u.active).length

  return (
    <>
      <AdminPageHeader
        title="Users"
        description="ADMIN can change anything. EDITOR can manage content but not settings, users or redirects. AUTHOR can write and edit their own posts only. Role checks are enforced server-side on every mutation."
      />
      <UsersManager
        users={users.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, bio: u.bio ?? '' }))}
        currentUserId={gate.user.id}
        activeAdmins={activeAdmins}
      />
    </>
  )
}
