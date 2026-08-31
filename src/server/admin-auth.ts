import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export class UnauthorizedError extends Error {
  constructor(message = 'Não autenticado') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Sem autorização') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions)

  if (!session) {
    throw new UnauthorizedError()
  }

  if (session.user.role !== 'ADMIN') {
    throw new ForbiddenError()
  }

  return session
}