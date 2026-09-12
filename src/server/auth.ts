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
import {
  clearFailedLogins,
  isLoginBlocked,
  recordFailedLogin,
} from './login-security'

type CredentialsInput =
  | {
      email?: string
      password?: string
    }
  | undefined

/*
 * Hash bcrypt fictício com cost 12.
 *
 * É usado apenas para fazer trabalho bcrypt
 * quando não existe uma conta válida para
 * comparar, reduzindo diferenças de timing.
 *
 * Não corresponde a nenhuma password real
 * da aplicação.
 */
const DUMMY_PASSWORD_HASH =
  '$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

async function performDummyPasswordCheck(
  password: string,
) {
  await compare(
    password,
    DUMMY_PASSWORD_HASH,
  )
}

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
        failedLoginAttempts: true,
        failedLoginWindowStartedAt:
          true,
        loginBlockedUntil: true,
      },
    })

  if (!user) {
    await performDummyPasswordCheck(
      passwordResult.data,
    )

    return null
  }

  if (!user.isActive) {
    await performDummyPasswordCheck(
      passwordResult.data,
    )

    return null
  }

  if (
    isLoginBlocked(
      user.loginBlockedUntil,
    )
  ) {
    await performDummyPasswordCheck(
      passwordResult.data,
    )

    return null
  }

  const isPasswordValid =
    await compare(
      passwordResult.data,
      user.passwordHash,
    )

  if (!isPasswordValid) {
    await recordFailedLogin(
      user.id,
    )

    return null
  }

  await clearFailedLogins(
    user.id,
  )

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