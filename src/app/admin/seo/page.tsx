import { getSettings } from '@/lib/settings'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader } from '@/components/admin/ui'
import { SeoSettingsEditor } from '@/components/admin/seo-settings-editor'

export const dynamic = 'force-dynamic'

export default async function SeoSettingsPage() {
  const gate = await requireRole('ADMIN')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const { seo } = await getSettings()

  return (
    <>
      <AdminPageHeader
        title="SEO settings"
        description="Site-wide defaults. There is no keywords field here or anywhere else — meta keywords is a deprecated signal and this site does not emit it."
      />
      <SeoSettingsEditor initial={seo} />
    </>
  )
}
