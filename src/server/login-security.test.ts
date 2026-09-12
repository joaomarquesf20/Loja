import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(
  () => ({
    transaction: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  }),
)

vi.mock('./db', () => ({
  prisma: {
    $transaction:
      mocks.transaction,
    user: {
      updateMany:
        mocks.updateMany,
    },
  },
}))

import {
  clearFailedLogins,
  isLoginBlocked,
  LOGIN_BLOCK_DURATION_MS,
  recordFailedLogin,
} from './login-security'

describe('login-security', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    mocks.transaction
      .mockImplementation(
        async (
          callback: (
            tx: unknown,
          ) => Promise<unknown>,
        ) =>
          callback({
            user: {
              findUnique:
                mocks.findUnique,
              update:
                mocks.update,
            },
          }),
      )

    mocks.update
      .mockResolvedValue({})

    mocks.updateMany
      .mockResolvedValue({
        count: 1,
      })
  })

  test('deteta bloqueio ainda ativo', () => {
    const now =
      new Date(
        '2026-09-12T12:00:00Z',
      )

    expect(
      isLoginBlocked(
        new Date(
          '2026-09-12T12:05:00Z',
        ),
        now,
      ),
    ).toBe(true)

    expect(
      isLoginBlocked(
        new Date(
          '2026-09-12T11:59:59Z',
        ),
        now,
      ),
    ).toBe(false)

    expect(
      isLoginBlocked(
        null,
        now,
      ),
    ).toBe(false)
  })

  test('regista primeira falha', async () => {
    const now =
      new Date(
        '2026-09-12T12:00:00Z',
      )

    mocks.findUnique
      .mockResolvedValue({
        isActive: true,
        failedLoginAttempts: 0,
        failedLoginWindowStartedAt:
          null,
        loginBlockedUntil: null,
      })

    await recordFailedLogin(
      'user-1',
      now,
    )

    expect(
      mocks.update,
    ).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
      data: {
        failedLoginAttempts: 1,
        failedLoginWindowStartedAt:
          now,
        loginBlockedUntil: null,
      },
    })
  })

  test('bloqueia após a quinta falha dentro da janela', async () => {
    const now =
      new Date(
        '2026-09-12T12:00:00Z',
      )

    const windowStartedAt =
      new Date(
        '2026-09-12T11:55:00Z',
      )

    mocks.findUnique
      .mockResolvedValue({
        isActive: true,
        failedLoginAttempts: 4,
        failedLoginWindowStartedAt:
          windowStartedAt,
        loginBlockedUntil: null,
      })

    await recordFailedLogin(
      'user-1',
      now,
    )

    expect(
      mocks.update,
    ).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
      data: {
        failedLoginAttempts: 5,
        failedLoginWindowStartedAt:
          windowStartedAt,
        loginBlockedUntil:
          new Date(
            now.getTime() +
              LOGIN_BLOCK_DURATION_MS,
          ),
      },
    })
  })

  test('reinicia contador quando a janela expirou', async () => {
    const now =
      new Date(
        '2026-09-12T12:00:00Z',
      )

    mocks.findUnique
      .mockResolvedValue({
        isActive: true,
        failedLoginAttempts: 4,
        failedLoginWindowStartedAt:
          new Date(
            '2026-09-12T11:30:00Z',
          ),
        loginBlockedUntil: null,
      })

    await recordFailedLogin(
      'user-1',
      now,
    )

    expect(
      mocks.update,
    ).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
      data: {
        failedLoginAttempts: 1,
        failedLoginWindowStartedAt:
          now,
        loginBlockedUntil: null,
      },
    })
  })

  test('reinicia contador depois de um bloqueio expirado', async () => {
    const now =
      new Date(
        '2026-09-12T12:00:00Z',
      )

    mocks.findUnique
      .mockResolvedValue({
        isActive: true,
        failedLoginAttempts: 5,
        failedLoginWindowStartedAt:
          new Date(
            '2026-09-12T11:40:00Z',
          ),
        loginBlockedUntil:
          new Date(
            '2026-09-12T11:59:00Z',
          ),
      })

    await recordFailedLogin(
      'user-1',
      now,
    )

    expect(
      mocks.update,
    ).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
      data: {
        failedLoginAttempts: 1,
        failedLoginWindowStartedAt:
          now,
        loginBlockedUntil: null,
      },
    })
  })

  test('não altera utilizador que já está bloqueado', async () => {
    const now =
      new Date(
        '2026-09-12T12:00:00Z',
      )

    mocks.findUnique
      .mockResolvedValue({
        isActive: true,
        failedLoginAttempts: 5,
        failedLoginWindowStartedAt:
          now,
        loginBlockedUntil:
          new Date(
            '2026-09-12T12:10:00Z',
          ),
      })

    await recordFailedLogin(
      'user-1',
      now,
    )

    expect(
      mocks.update,
    ).not.toHaveBeenCalled()
  })

  test('faz retry de conflito serializable P2034', async () => {
    mocks.transaction
      .mockRejectedValueOnce({
        code: 'P2034',
      })
      .mockImplementationOnce(
        async (
          callback: (
            tx: unknown,
          ) => Promise<unknown>,
        ) =>
          callback({
            user: {
              findUnique:
                mocks.findUnique,
              update:
                mocks.update,
            },
          }),
      )

    mocks.findUnique
      .mockResolvedValue({
        isActive: true,
        failedLoginAttempts: 0,
        failedLoginWindowStartedAt:
          null,
        loginBlockedUntil: null,
      })

    await recordFailedLogin(
      'user-1',
    )

    expect(
      mocks.transaction,
    ).toHaveBeenCalledTimes(2)
  })

  test('limpa estado de falhas após login válido', async () => {
    await clearFailedLogins(
      'user-1',
    )

    expect(
      mocks.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
        OR: [
          {
            failedLoginAttempts: {
              gt: 0,
            },
          },
          {
            failedLoginWindowStartedAt:
              {
                not: null,
              },
          },
          {
            loginBlockedUntil: {
              not: null,
            },
          },
        ],
      },
      data: {
        failedLoginAttempts: 0,
        failedLoginWindowStartedAt:
          null,
        loginBlockedUntil: null,
      },
    })
  })
})