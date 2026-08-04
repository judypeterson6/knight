import { requireRole } from '@/lib/auth'
import { AdminPageHeader } from '@/components/admin/ui'
import { NewPageForm } from '@/components/admin/new-page-form'

export const dynamic = 'force-dynamic'

export default async function NewPage() {
  const gate = await requireRole('EDITOR')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  return (
    <>
      <AdminPageHeader
        title="New page"
        description="Create the page, then build its block stack. The page type decides which Visual-Semantics layout it should follow."
      />
      <NewPageForm />
    </>
  )
}
