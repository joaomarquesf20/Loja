import { describe, expect, it, vi } from 'vitest'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('./auth', () => ({
  authOptions: {},
}))

import { getServerSession } from 'next-auth'
import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from './admin-auth'

const mockGetServerSession = vi.mocked(getServerSession)

describe('requireAdmin()', () => {
  it('should throw UnauthorizedError when no session', async () => {
    mockGetServerSession.mockResolvedValue(null)

    await expect(requireAdmin()).rejects.toThrow(UnauthorizedError)
  })

  it('should throw ForbiddenError when role is BUYER', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { role: 'BUYER' }
    })

    await expect(requireAdmin()).rejects.toThrow(ForbiddenError)
  })

  it('should throw ForbiddenError when role is SELLER', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { role: 'SELLER' }
    })

    await expect(requireAdmin()).rejects.toThrow(ForbiddenError)
  })

  it('should return session when role is ADMIN', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { role: 'ADMIN' }
    })

    const session = await requireAdmin()

    expect(session).toBeDefined()
    expect(session.user.role).toBe('ADMIN')
  })
})