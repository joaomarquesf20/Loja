import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(
  () => ({
    create: vi.fn(),
    hash: vi.fn(),
  }),
)

vi.mock('./db', () => ({
  prisma: {
    user: {
      create: mocks.create,
    },
  },
}))

vi.mock('bcryptjs', () => ({
  hash: mocks.hash,
}))

import {
  registerBuyer,
  RegistrationEmailConflictError,
  RegistrationValidationError,
} from './register'

describe('registerBuyer', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    mocks.hash.mockResolvedValue(
      'hashed-password',
    )

    mocks.create.mockResolvedValue({
      id: 'user-1',
      email:
        'buyer@example.com',
      name: 'Buyer Teste',
      role: 'BUYER',
      isActive: true,
    })
  })

  test('rejeita nome inválido antes de criar utilizador', async () => {
    await expect(
      registerBuyer({
        name: '   ',
        email:
          'buyer@example.com',
        password:
          'password123',
      }),
    ).rejects.toMatchObject({
      name:
        'RegistrationValidationError',
      field: 'name',
      message: 'Nome inválido',
    })

    expect(
      mocks.hash,
    ).not.toHaveBeenCalled()

    expect(
      mocks.create,
    ).not.toHaveBeenCalled()
  })

  test('rejeita email inválido antes de criar utilizador', async () => {
    await expect(
      registerBuyer({
        name: 'Buyer Teste',
        email:
          'email-invalido',
        password:
          'password123',
      }),
    ).rejects.toMatchObject({
      name:
        'RegistrationValidationError',
      field: 'email',
      message: 'Email inválido',
    })

    expect(
      mocks.hash,
    ).not.toHaveBeenCalled()

    expect(
      mocks.create,
    ).not.toHaveBeenCalled()
  })

  test('rejeita password curta antes de criar utilizador', async () => {
    await expect(
      registerBuyer({
        name: 'Buyer Teste',
        email:
          'buyer@example.com',
        password: '1234567',
      }),
    ).rejects.toMatchObject({
      name:
        'RegistrationValidationError',
      field: 'password',
      message:
        'A palavra-passe deve ter pelo menos 8 caracteres',
    })

    expect(
      mocks.hash,
    ).not.toHaveBeenCalled()

    expect(
      mocks.create,
    ).not.toHaveBeenCalled()
  })

  test('rejeita tipos inválidos', async () => {
    const invalidCases = [
      {
        input: {
          name: 123,
          email:
            'buyer@example.com',
          password:
            'password123',
        },
        field: 'name',
      },
      {
        input: {
          name: 'Buyer Teste',
          email: 123,
          password:
            'password123',
        },
        field: 'email',
      },
      {
        input: {
          name: 'Buyer Teste',
          email:
            'buyer@example.com',
          password: 123,
        },
        field: 'password',
      },
    ]

    for (
      const {
        input,
        field,
      } of invalidCases
    ) {
      await expect(
        registerBuyer(input),
      ).rejects.toMatchObject({
        name:
          'RegistrationValidationError',
        field,
      })
    }

    expect(
      mocks.hash,
    ).not.toHaveBeenCalled()

    expect(
      mocks.create,
    ).not.toHaveBeenCalled()
  })

  test('normaliza nome e email e cria sempre um BUYER ativo', async () => {
    const result =
      await registerBuyer({
        name: '  Buyer Teste  ',
        email:
          '  Buyer@Example.COM  ',
        password:
          'password123',
      })

    expect(
      mocks.hash,
    ).toHaveBeenCalledTimes(1)

    expect(
      mocks.hash,
    ).toHaveBeenCalledWith(
      'password123',
      12,
    )

    expect(
      mocks.create,
    ).toHaveBeenCalledTimes(1)

    expect(
      mocks.create,
    ).toHaveBeenCalledWith({
      data: {
        name: 'Buyer Teste',
        email:
          'buyer@example.com',
        passwordHash:
          'hashed-password',
        role: 'BUYER',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    })

    expect(result).toEqual({
      id: 'user-1',
      email:
        'buyer@example.com',
      name: 'Buyer Teste',
      role: 'BUYER',
      isActive: true,
    })
  })

  test('nunca guarda a password em texto simples', async () => {
    await registerBuyer({
      name: 'Buyer Teste',
      email:
        'buyer@example.com',
      password:
        'password123',
    })

    const createCall =
      mocks.create.mock.calls[0][0]

    expect(
      createCall.data.passwordHash,
    ).toBe('hashed-password')

    expect(
      createCall.data,
    ).not.toHaveProperty(
      'password',
    )

    expect(
      createCall.data.passwordHash,
    ).not.toBe('password123')
  })

  test('converte conflito P2002 em erro de email duplicado', async () => {
    mocks.create.mockRejectedValue({
      code: 'P2002',
    })

    await expect(
      registerBuyer({
        name: 'Buyer Teste',
        email:
          'buyer@example.com',
        password:
          'password123',
      }),
    ).rejects.toBeInstanceOf(
      RegistrationEmailConflictError,
    )
  })

  test('não transforma erros inesperados da base de dados', async () => {
    const databaseError =
      new Error(
        'Erro inesperado',
      )

    mocks.create.mockRejectedValue(
      databaseError,
    )

    await expect(
      registerBuyer({
        name: 'Buyer Teste',
        email:
          'buyer@example.com',
        password:
          'password123',
      }),
    ).rejects.toBe(databaseError)
  })

  test('expõe o tipo específico de erro de validação', () => {
    const error =
      new RegistrationValidationError(
        'email',
        'Email inválido',
      )

    expect(error).toBeInstanceOf(
      RegistrationValidationError,
    )

    expect(error.field).toBe(
      'email',
    )

    expect(error.message).toBe(
      'Email inválido',
    )
  })
})
