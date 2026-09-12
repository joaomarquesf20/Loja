import { getServerSession } from 'next-auth'

import { authOptions } from './auth'
import { prisma } from './db'

export class UnauthorizedError extends Error {
  constructor(
    message = 'Não autenticado',
  ) {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor(
    message = 'Sem autorização',
  ) {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export async function requireAdmin() {
  const session =
    await getServerSession(authOptions)

  const userId =
    session?.user?.id?.trim()

  if (!session || !userId) {
    throw new UnauthorizedError()
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        role: true,
        isActive: true,
      },
    })

  if (!user || !user.isActive) {
    throw new UnauthorizedError()
  }

  if (user.role !== 'ADMIN') {
    throw new ForbiddenError()
  }

  return session
}