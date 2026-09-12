import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(
  () => ({
    getServerSession: vi.fn(),
    findUnique: vi.fn(),
  }),
)

vi.mock('next-auth', () => ({
  getServerSession:
    mocks.getServerSession,
}))

vi.mock('./auth', () => ({
  authOptions: {},
}))

vi.mock('./db', () => ({
  prisma: {
    user: {
      findUnique:
        mocks.findUnique,
    },
  },
}))

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from './admin-auth'

describe('requireAdmin()', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should throw UnauthorizedError when no session', async () => {
    mocks.getServerSession.mockResolvedValue(
      null,
    )

    await expect(
      requireAdmin(),
    ).rejects.toThrow(
      UnauthorizedError,
    )

    expect(
      mocks.findUnique,
    ).not.toHaveBeenCalled()
  })

  it('should throw UnauthorizedError when session has no user id', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: {
        id: '   ',
        role: 'ADMIN',
      },
    })

    await expect(
      requireAdmin(),
    ).rejects.toThrow(
      UnauthorizedError,
    )

    expect(
      mocks.findUnique,
    ).not.toHaveBeenCalled()
  })

  it('should throw UnauthorizedError when user no longer exists', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: {
        id: 'admin-1',
        role: 'ADMIN',
      },
    })

    mocks.findUnique.mockResolvedValue(
      null,
    )

    await expect(
      requireAdmin(),
    ).rejects.toThrow(
      UnauthorizedError,
    )
  })

  it('should throw UnauthorizedError when admin is inactive', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: {
        id: 'admin-1',
        role: 'ADMIN',
      },
    })

    mocks.findUnique.mockResolvedValue({
      role: 'ADMIN',
      isActive: false,
    })

    await expect(
      requireAdmin(),
    ).rejects.toThrow(
      UnauthorizedError,
    )
  })

  it('should throw ForbiddenError when current role is BUYER', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: {
        id: 'user-1',
        role: 'ADMIN',
      },
    })

    mocks.findUnique.mockResolvedValue({
      role: 'BUYER',
      isActive: true,
    })

    await expect(
      requireAdmin(),
    ).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('should throw ForbiddenError when current role is SELLER', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: {
        id: 'user-1',
        role: 'ADMIN',
      },
    })

    mocks.findUnique.mockResolvedValue({
      role: 'SELLER',
      isActive: true,
    })

    await expect(
      requireAdmin(),
    ).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('should return session when current database role is active ADMIN', async () => {
    const session = {
      user: {
        id: ' admin-1 ',
        role: 'BUYER',
      },
    }

    mocks.getServerSession.mockResolvedValue(
      session,
    )

    mocks.findUnique.mockResolvedValue({
      role: 'ADMIN',
      isActive: true,
    })

    const result =
      await requireAdmin()

    expect(result).toBe(session)

    expect(
      mocks.findUnique,
    ).toHaveBeenCalledWith({
      where: {
        id: 'admin-1',
      },
      select: {
        role: true,
        isActive: true,
      },
    })
  })
})