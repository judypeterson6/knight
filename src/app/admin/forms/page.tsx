import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { AdminPageHeader, Panel } from '@/components/admin/ui'
import { FormBuilder } from '@/components/admin/form-builder'

export const dynamic = 'force-dynamic'

export default async function FormsAdmin() {
  const gate = await requireRole('ADMIN')
  if (!gate.ok) return <p className="text-danger">{gate.error}</p>

  const forms = await prisma.form
    .findMany({
      orderBy: { slug: 'asc' },
      include: { fields: { orderBy: { order: 'asc' } }, _count: { select: { submissions: true } } },
    })
    .catch(() => [])

  return (
    <>
      <AdminPageHeader
        title="Forms"
        description="Fields are configurable per form: label, type, required, options and conditional visibility. Validation on the public endpoint is generated from these rows, so the rules always match what the visitor was shown."
      />

      {forms.map((form) => (
        <Panel
          key={form.id}
          title={form.name}
          description={`/${form.slug} · ${form._count.submissions} submission(s)`}
          className="mb-8"
        >
          <FormBuilder
            slug={form.slug}
            settings={{
              name: form.name,
              description: form.description ?? '',
              submitLabel: form.submitLabel,
              successTitle: form.successTitle,
              successBody: form.successBody,
              notifyEmail: form.notifyEmail ?? '',
              enabled: form.enabled,
            }}
            fields={form.fields.map((field) => ({
              id: field.id,
              name: field.name,
              label: field.label,
              type: field.type,
              placeholder: field.placeholder ?? '',
              helpText: field.helpText ?? '',
              required: field.required,
              options: Array.isArray(field.options) ? (field.options as string[]) : [],
              order: field.order,
              showWhen: field.showWhen ?? '',
              halfWidth: field.halfWidth,
            }))}
          />
        </Panel>
      ))}
    </>
  )
}
