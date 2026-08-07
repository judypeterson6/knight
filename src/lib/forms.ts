import 'server-only'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import type { FormFieldType } from '@prisma/client'

export interface PublicFormField {
  id: string
  name: string
  label: string
  type: FormFieldType
  placeholder: string | null
  helpText: string | null
  required: boolean
  options: string[]
  order: number
  showWhen: string | null
  halfWidth: boolean
  /** Multi-step grouping. Everything on step 1 = a single-page form. */
  step: number
  stepTitle: string | null
}

export interface PublicForm {
  id: string
  slug: string
  name: string
  description: string | null
  submitLabel: string
  successTitle: string
  successBody: string
  fields: PublicFormField[]
}

async function loadForm(slug: string): Promise<PublicForm | null> {
  try {
    const form = await prisma.form.findUnique({
      where: { slug },
      include: { fields: { orderBy: [{ step: 'asc' }, { order: 'asc' }] } },
    })
    if (!form || !form.enabled) return null
    return {
      id: form.id,
      slug: form.slug,
      name: form.name,
      description: form.description,
      submitLabel: form.submitLabel,
      successTitle: form.successTitle,
      successBody: form.successBody,
      fields: form.fields.map((f) => ({
        id: f.id,
        name: f.name,
        label: f.label,
        type: f.type,
        placeholder: f.placeholder,
        helpText: f.helpText,
        required: f.required,
        options: Array.isArray(f.options) ? (f.options as string[]) : [],
        order: f.order,
        showWhen: f.showWhen,
        halfWidth: f.halfWidth,
        step: f.step,
        stepTitle: f.stepTitle,
      })),
    }
  } catch {
    return null
  }
}

export const getForm = (slug: string) =>
  unstable_cache(() => loadForm(slug), ['form', slug], {
    tags: ['forms', `form:${slug}`],
    revalidate: 3600,
  })()
