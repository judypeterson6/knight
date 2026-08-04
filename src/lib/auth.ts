import NextAuth, { type DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { Role } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: { id: string; role: Role } & DefaultSession['user']
  }
  interface User {
    role: Role
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  trustHost: true,
  pages: { signIn: '/admin/login', error: '/admin/login' },
  providers: [
    Credentials({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } })
        // Compare against a dummy hash when the user is missing so a failed
        // lookup takes the same time as a wrong password.
        const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv'
        const ok = await bcrypt.compare(parsed.data.password, hash)
        if (!user || !ok || !user.active) return null

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => undefined)

        return { id: user.id, name: user.name, email: user.email, role: user.role, image: null }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string
      if (token.role) session.user.role = token.role as Role
      return session
    },
  },
})

const RANK: Record<Role, number> = { AUTHOR: 1, EDITOR: 2, ADMIN: 3 }

/**
 * Server-side role gate. Every mutation calls this — the admin UI hiding a
 * button is a convenience, not the control.
 */
export async function requireRole(minimum: Role) {
  const session = await auth()
  if (!session?.user?.id) return { ok: false as const, status: 401, error: 'Not signed in' }
  if (RANK[session.user.role] < RANK[minimum]) {
    return { ok: false as const, status: 403, error: 'Insufficient permissions' }
  }
  return { ok: true as const, session, user: session.user }
}

export async function currentUser() {
  const session = await auth()
  return session?.user ?? null
}
