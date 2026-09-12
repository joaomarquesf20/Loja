import type {
  NextAuthOptions,
} from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'

import {
  emailSchema,
  passwordSchema,
} from '@/lib/validation'

import { prisma } from './db'

type CredentialsInput =
  | {
      email?: string
      password?: string
    }
  | undefined

export async function authorizeCredentials(
  credentials: CredentialsInput,
) {
  if (
    !credentials?.email ||
    !credentials?.password
  ) {
    return null
  }

  const emailResult =
    emailSchema.safeParse(
      credentials.email,
    )

  const passwordResult =
    passwordSchema.safeParse(
      credentials.password,
    )

  if (
    !emailResult.success ||
    !passwordResult.success
  ) {
    return null
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email: emailResult.data,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        passwordHash: true,
      },
    })

  if (!user) {
    return null
  }

  if (user.isActive === false) {
    return null
  }

  const isPasswordValid =
    await compare(
      passwordResult.data,
      user.passwordHash,
    )

  if (!isPasswordValid) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  }
}

export const authOptions:
  NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: {
          label: 'Email',
          type: 'email',
        },
        password: {
          label: 'Password',
          type: 'password',
        },
      },
      authorize:
        authorizeCredentials,
    }),
  ],
  callbacks: {
    async jwt({
      token,
      user,
    }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }

      return token
    },

    async session({
      session,
      token,
    }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role =
          token.role
      }

      return session
    },
  },
}