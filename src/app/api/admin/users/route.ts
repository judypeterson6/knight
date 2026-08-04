import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { fail, guard, ok, parseBody } from '@/lib/api'
import { userCreateSchema } from '@/lib/admin-schemas'
import { prismaMessage } from '@/lib/crud'
import { sendMail } from '@/lib/mail'
import { absoluteUrl } from '@/lib/utils'

export const runtime = 'nodejs'

const SAFE_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  bio: true,
  lastLoginAt: true,
  createdAt: true,
  avatar: { select: { path: true, alt: true } },
} as const

export async function GET(): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response
  // The password hash is never selected, so it can never leak through the API.
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' }, select: SAFE_FIELDS })
  return ok(users)
}

/**
 * Creates a user. If `password` is omitted the caller gets a generated one back
 * once, and an invitation email is attempted.
 */
export async function POST(request: Request): Promise<Response> {
  const gate = await guard('ADMIN')
  if (!gate.ok) return gate.response

  const body = await parseBody(request, userCreateSchema.partial({ password: true }))
  if (!body.ok) return body.response

  const generated = body.data.password ? null : generatePassword()
  const password = body.data.password ?? generated ?? ''

  try {
    const user = await prisma.user.create({
      data: {
        name: body.data.name,
        email: body.data.email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 12),
        role: body.data.role ?? 'AUTHOR',
        bio: body.data.bio ?? null,
        active: body.data.active ?? true,
        avatarId: body.data.avatarId ?? null,
      },
      select: SAFE_FIELDS,
    })

    const mail = await sendMail({
      to: user.email,
      subject: 'Your Knights Coaches admin account',
      text: [
        `Hello ${user.name},`,
        '',
        'An account has been created for you on the Knights Coaches website administration.',
        '',
        `Sign in: ${absoluteUrl('/admin/login')}`,
        `Email: ${user.email}`,
        `Password: ${password}`,
        '',
        'Please change the password after your first sign-in.',
      ].join('\n'),
    })

    return ok({ user, generatedPassword: generated, invitationSent: mail.sent, mailError: mail.error }, 201)
  } catch (error) {
    return fail(prismaMessage(error), 409)
  }
}

function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  const bytes = new Uint32Array(20)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join('')
}
