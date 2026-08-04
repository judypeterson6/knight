import { getSettings } from '@/lib/settings'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader } from '@/components/admin/ui'
import { AppearanceEditor } from '@/components/admin/appearance-editor'

export const dynamic = 'force-dynamic'

export default async function AppearanceAdmin() {
  const gate = await requireRole('ADMIN')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const settings = await getSettings()

  return (
    <>
      <AdminPageHeader
        title="Appearance"
        description="Colours, fonts, heading scale, logos, custom CSS and injected scripts. Every value here is emitted as a CSS custom property, so changing one restyles the whole site without a deploy."
      />
      <AppearanceEditor
        theme={settings.theme}
        fonts={settings.fonts}
        headings={settings.headings}
        branding={settings.branding}
        organization={settings.organization}
        trust={settings.trust}
        scripts={settings.scripts}
        customCss={settings.customCss}
      />
    </>
  )
}
