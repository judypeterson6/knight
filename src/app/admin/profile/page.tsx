import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader } from '@/components/admin/ui'
import { ProfileEditor } from '@/components/admin/profile-editor'

export const dynamic = 'force-dynamic'

export default async function ProfileAdmin() {
  const gate = await requireRole('AUTHOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const user = await prisma.user
    .findUnique({
      where: { id: gate.user.id },
      select: { id: true, name: true, email: true, role: true, bio: true, lastLoginAt: true },
    })
    .catch(() => null)

  if (!user) return <p className="text-danger">Your account could not be loaded.</p>

  return (
    <>
      <AdminPageHeader
        title="My profile"
        description={`Signed in as ${user.email} · ${user.role}${user.lastLoginAt ? ` · last sign-in ${user.lastLoginAt.toLocaleString()}` : ''}`}
      />
      <ProfileEditor initial={{ name: user.name, bio: user.bio ?? '' }} />
    </>
  )
}
