import { getSettings } from '@/lib/settings'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader } from '@/components/admin/ui'
import { MailSettingsEditor } from '@/components/admin/mail-settings-editor'

export const dynamic = 'force-dynamic'

export default async function MailSettingsPage() {
  const gate = await requireRole('ADMIN')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const { mail } = await getSettings()

  return (
    <>
      <AdminPageHeader
        title="Mail (SMTP)"
        description="Where quote requests and contact messages are sent from. Changes apply immediately — no redeploy."
      />
      {/* The password is deliberately not passed to the client; only whether
          one exists, so the editor can say so without shipping the secret. */}
      <MailSettingsEditor
        initial={{ ...mail, password: '' }}
        hasPassword={Boolean(mail.password)}
        envHost={process.env.SMTP_HOST ?? ''}
      />
    </>
  )
}
