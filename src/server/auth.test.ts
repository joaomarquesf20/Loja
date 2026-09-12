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

import {
  authorizeCredentials,
} from './auth'

describe(
  'authorizeCredentials',
  () => {
    beforeEach(() => {
      vi.resetAllMocks()
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

    test('normaliza email antes da pesquisa', async () => {
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
        },
      })

      expect(
        mocks.compare,
      ).toHaveBeenCalledWith(
        'password123',
        'password-hash',
      )

      expect(result).toEqual({
        id: 'user-1',
        email:
          'buyer@example.com',
        name: 'Buyer',
        role: 'BUYER',
      })
    })

    test('rejeita utilizador inativo sem verificar password', async () => {
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
        },
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
      ).not.toHaveBeenCalled()
    })

    test('rejeita password incorreta', async () => {
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
      ).toHaveBeenCalledTimes(1)
    })
  },
)