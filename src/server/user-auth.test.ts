import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(
  () => ({
    getServerSession:
      vi.fn(),
    findUnique:
      vi.fn(),
  }),
)

vi.mock(
  'next-auth',
  () => ({
    getServerSession:
      mocks.getServerSession,
  }),
)

vi.mock(
  './auth',
  () => ({
    authOptions: {},
  }),
)

vi.mock(
  './db',
  () => ({
    prisma: {
      user: {
        findUnique:
          mocks.findUnique,
      },
    },
  }),
)

import {
  requireActiveUserId,
  UnauthorizedUserError,
} from './user-auth'

describe(
  'requireActiveUserId()',
  () => {
    beforeEach(() => {
      vi.resetAllMocks()
    })

    it('rejects when there is no session', async () => {
      mocks.getServerSession
        .mockResolvedValue(null)

      await expect(
        requireActiveUserId(),
      ).rejects.toThrow(
        UnauthorizedUserError,
      )

      expect(
        mocks.findUnique,
      ).not.toHaveBeenCalled()
    })

    it('rejects when the session has no user id', async () => {
      mocks.getServerSession
        .mockResolvedValue({
          user: {
            id: '   ',
          },
        })

      await expect(
        requireActiveUserId(),
      ).rejects.toThrow(
        UnauthorizedUserError,
      )

      expect(
        mocks.findUnique,
      ).not.toHaveBeenCalled()
    })

    it('rejects when the user no longer exists', async () => {
      mocks.getServerSession
        .mockResolvedValue({
          user: {
            id: 'user-1',
          },
        })

      mocks.findUnique
        .mockResolvedValue(null)

      await expect(
        requireActiveUserId(),
      ).rejects.toThrow(
        UnauthorizedUserError,
      )
    })

    it('rejects an inactive user', async () => {
      mocks.getServerSession
        .mockResolvedValue({
          user: {
            id: 'user-1',
          },
        })

      mocks.findUnique
        .mockResolvedValue({
          id: 'user-1',
          isActive: false,
        })

      await expect(
        requireActiveUserId(),
      ).rejects.toThrow(
        UnauthorizedUserError,
      )
    })

    it('returns the current active database user id', async () => {
      mocks.getServerSession
        .mockResolvedValue({
          user: {
            id: ' user-1 ',
            role: 'BUYER',
          },
        })

      mocks.findUnique
        .mockResolvedValue({
          id: 'user-1',
          isActive: true,
        })

      await expect(
        requireActiveUserId(),
      ).resolves.toBe(
        'user-1',
      )

      expect(
        mocks.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          id: 'user-1',
        },
        select: {
          id: true,
          isActive: true,
        },
      })
    })
  },
)