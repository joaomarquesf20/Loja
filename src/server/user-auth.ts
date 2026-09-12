import { getServerSession } from 'next-auth'

import { authOptions } from './auth'
import { prisma } from './db'

export class UnauthorizedUserError extends Error {
  constructor(
    message = 'Não autenticado',
  ) {
    super(message)
    this.name =
      'UnauthorizedUserError'
  }
}

export async function requireActiveUserId() {
  const session =
    await getServerSession(
      authOptions,
    )

  const sessionUserId =
    session?.user?.id?.trim()

  if (!sessionUserId) {
    throw new UnauthorizedUserError()
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: sessionUserId,
      },
      select: {
        id: true,
        isActive: true,
      },
    })

  if (
    !user ||
    !user.isActive
  ) {
    throw new UnauthorizedUserError()
  }

  return user.id
}