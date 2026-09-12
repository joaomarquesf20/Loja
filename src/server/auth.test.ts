import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(
  () => ({
    findUnique: vi.fn(),
    compare: vi.fn(),
    isLoginBlocked: vi.fn(),
    recordFailedLogin: vi.fn(),
    clearFailedLogins: vi.fn(),
  }),
)

vi.mock('./db', () => ({
  prisma: {
    user: {
      findUnique:
        mocks.findUnique,
    },
  },
}))

vi.mock('bcryptjs', () => ({
  compare: mocks.compare,
}))

vi.mock(
  './login-security',
  () => ({
    isLoginBlocked:
      mocks.isLoginBlocked,
    recordFailedLogin:
      mocks.recordFailedLogin,
    clearFailedLogins:
      mocks.clearFailedLogins,
  }),
)

import {
  authorizeCredentials,
} from './auth'

describe(
  'authorizeCredentials',
  () => {
    beforeEach(() => {
      vi.resetAllMocks()

      mocks.isLoginBlocked
        .mockReturnValue(false)

      mocks.recordFailedLogin
        .mockResolvedValue(
          undefined,
        )

      mocks.clearFailedLogins
        .mockResolvedValue(
          undefined,
        )
    })

    test('rejeita credenciais incompletas', async () => {
      await expect(
        authorizeCredentials(
          undefined,
        ),
      ).resolves.toBeNull()

      await expect(
        authorizeCredentials({
          email:
            'buyer@example.com',
        }),
      ).resolves.toBeNull()

      expect(
        mocks.findUnique,
      ).not.toHaveBeenCalled()

      expect(
        mocks.compare,
      ).not.toHaveBeenCalled()
    })

    test('rejeita email inválido antes de consultar a base de dados', async () => {
      const result =
        await authorizeCredentials(
          {
            email:
              'email-invalido',
            password:
              'password123',
          },
        )

      expect(result).toBeNull()

      expect(
        mocks.findUnique,
      ).not.toHaveBeenCalled()

      expect(
        mocks.compare,
      ).not.toHaveBeenCalled()
    })

    test('rejeita password curta antes de consultar a base de dados', async () => {
      const result =
        await authorizeCredentials(
          {
            email:
              'buyer@example.com',
            password:
              '1234567',
          },
        )

      expect(result).toBeNull()

      expect(
        mocks.findUnique,
      ).not.toHaveBeenCalled()

      expect(
        mocks.compare,
      ).not.toHaveBeenCalled()
    })

    test('rejeita password com mais de 72 bytes antes de consultar a base de dados', async () => {
      const result =
        await authorizeCredentials(
          {
            email:
              'buyer@example.com',
            password:
              'a'.repeat(73),
          },
        )

      expect(result).toBeNull()

      expect(
        mocks.findUnique,
      ).not.toHaveBeenCalled()

      expect(
        mocks.compare,
      ).not.toHaveBeenCalled()
    })

    test('faz comparação bcrypt fictícia quando o utilizador não existe', async () => {
      mocks.findUnique
        .mockResolvedValue(null)

      mocks.compare
        .mockResolvedValue(false)

      const result =
        await authorizeCredentials(
          {
            email:
              'missing@example.com',
            password:
              'password123',
          },
        )

      expect(result).toBeNull()

      expect(
        mocks.compare,
      ).toHaveBeenCalledTimes(1)

      expect(
        mocks.compare,
      ).toHaveBeenCalledWith(
        'password123',
        expect.stringMatching(
          /^\$2[aby]\$12\$/,
        ),
      )

      expect(
        mocks.recordFailedLogin,
      ).not.toHaveBeenCalled()

      expect(
        mocks.clearFailedLogins,
      ).not.toHaveBeenCalled()
    })

    test('normaliza email antes da pesquisa e limpa falhas após login válido', async () => {
      mocks.findUnique.mockResolvedValue(
        {
          id: 'user-1',
          email:
            'buyer@example.com',
          name: 'Buyer',
          role: 'BUYER',
          isActive: true,
          passwordHash:
            'password-hash',
          failedLoginAttempts: 2,
          failedLoginWindowStartedAt:
            new Date(),
          loginBlockedUntil: null,
        },
      )

      mocks.compare.mockResolvedValue(
        true,
      )

      const result =
        await authorizeCredentials(
          {
            email:
              '  Buyer@Example.COM  ',
            password:
              'password123',
          },
        )

      expect(
        mocks.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          email:
            'buyer@example.com',
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

      expect(
        mocks.compare,
      ).toHaveBeenCalledWith(
        'password123',
        'password-hash',
      )

      expect(
        mocks.clearFailedLogins,
      ).toHaveBeenCalledWith(
        'user-1',
      )

      expect(
        mocks.recordFailedLogin,
      ).not.toHaveBeenCalled()

      expect(result).toEqual({
        id: 'user-1',
        email:
          'buyer@example.com',
        name: 'Buyer',
        role: 'BUYER',
      })
    })

    test('rejeita utilizador inativo com trabalho bcrypt fictício', async () => {
      mocks.findUnique.mockResolvedValue(
        {
          id: 'user-1',
          email:
            'buyer@example.com',
          name: 'Buyer',
          role: 'BUYER',
          isActive: false,
          passwordHash:
            'password-hash',
          failedLoginAttempts: 0,
          failedLoginWindowStartedAt:
            null,
          loginBlockedUntil: null,
        },
      )

      mocks.compare.mockResolvedValue(
        false,
      )

      const result =
        await authorizeCredentials(
          {
            email:
              'buyer@example.com',
            password:
              'password123',
          },
        )

      expect(result).toBeNull()

      expect(
        mocks.compare,
      ).toHaveBeenCalledTimes(1)

      expect(
        mocks.recordFailedLogin,
      ).not.toHaveBeenCalled()

      expect(
        mocks.clearFailedLogins,
      ).not.toHaveBeenCalled()
    })

    test('rejeita conta temporariamente bloqueada antes de validar a password real', async () => {
      mocks.findUnique.mockResolvedValue(
        {
          id: 'user-1',
          email:
            'buyer@example.com',
          name: 'Buyer',
          role: 'BUYER',
          isActive: true,
          passwordHash:
            'password-hash',
          failedLoginAttempts: 5,
          failedLoginWindowStartedAt:
            new Date(),
          loginBlockedUntil:
            new Date(
              Date.now() +
                60_000,
            ),
        },
      )

      mocks.isLoginBlocked
        .mockReturnValue(true)

      mocks.compare
        .mockResolvedValue(false)

      const result =
        await authorizeCredentials(
          {
            email:
              'buyer@example.com',
            password:
              'password123',
          },
        )

      expect(result).toBeNull()

      expect(
        mocks.compare,
      ).toHaveBeenCalledTimes(1)

      expect(
        mocks.compare,
      ).not.toHaveBeenCalledWith(
        'password123',
        'password-hash',
      )

      expect(
        mocks.recordFailedLogin,
      ).not.toHaveBeenCalled()

      expect(
        mocks.clearFailedLogins,
      ).not.toHaveBeenCalled()
    })

    test('regista falha quando a password está incorreta', async () => {
      mocks.findUnique.mockResolvedValue(
        {
          id: 'user-1',
          email:
            'buyer@example.com',
          name: 'Buyer',
          role: 'BUYER',
          isActive: true,
          passwordHash:
            'password-hash',
          failedLoginAttempts: 1,
          failedLoginWindowStartedAt:
            new Date(),
          loginBlockedUntil: null,
        },
      )

      mocks.compare.mockResolvedValue(
        false,
      )

      const result =
        await authorizeCredentials(
          {
            email:
              'buyer@example.com',
            password:
              'password-errada',
          },
        )

      expect(result).toBeNull()

      expect(
        mocks.compare,
      ).toHaveBeenCalledWith(
        'password-errada',
        'password-hash',
      )

      expect(
        mocks.recordFailedLogin,
      ).toHaveBeenCalledWith(
        'user-1',
      )

      expect(
        mocks.clearFailedLogins,
      ).not.toHaveBeenCalled()
    })
  },
)