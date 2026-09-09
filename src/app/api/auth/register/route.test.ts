import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('@/server/register', () => {
  class RegistrationValidationError
    extends Error {
    constructor(
      public readonly field:
        | 'name'
        | 'email'
        | 'password',
      message: string,
    ) {
      super(message)
      this.name =
        'RegistrationValidationError'
    }
  }

  class RegistrationEmailConflictError
    extends Error {
    constructor(
      message =
        'Já existe uma conta com este email',
    ) {
      super(message)
      this.name =
        'RegistrationEmailConflictError'
    }
  }

  return {
    registerBuyer: vi.fn(),
    RegistrationValidationError,
    RegistrationEmailConflictError,
  }
})

import {
  registerBuyer,
  RegistrationEmailConflictError,
  RegistrationValidationError,
} from '@/server/register'
import { POST } from './route'

const mockRegisterBuyer =
  vi.mocked(registerBuyer)

function createRequest(
  body: string,
) {
  return new Request(
    'http://localhost/api/auth/register',
    {
      method: 'POST',
      headers: {
        'content-type':
          'application/json',
      },
      body,
    },
  )
}

describe(
  '/api/auth/register',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mockRegisterBuyer.mockResolvedValue(
        {
          id: 'user-1',
          email:
            'buyer@example.com',
          name: 'Buyer Teste',
          role: 'BUYER',
          isActive: true,
        },
      )
    })

    test('rejeita JSON inválido', async () => {
      const response = await POST(
        createRequest('{'),
      )

      expect(response.status).toBe(
        400,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'JSON inválido',
        code: 'INVALID_JSON',
      })

      expect(
        mockRegisterBuyer,
      ).not.toHaveBeenCalled()
    })

    test('rejeita corpo que não seja objeto', async () => {
      const response = await POST(
        createRequest(
          JSON.stringify([]),
        ),
      )

      expect(response.status).toBe(
        400,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Pedido inválido',
        code: 'INVALID_REQUEST',
      })

      expect(
        mockRegisterBuyer,
      ).not.toHaveBeenCalled()
    })

    test('devolve INVALID_NAME para nome inválido', async () => {
      mockRegisterBuyer.mockRejectedValue(
        new RegistrationValidationError(
          'name',
          'Nome inválido',
        ),
      )

      const response = await POST(
        createRequest(
          JSON.stringify({
            name: '',
            email:
              'buyer@example.com',
            password:
              'password123',
          }),
        ),
      )

      expect(response.status).toBe(
        400,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Nome inválido',
        code: 'INVALID_NAME',
      })
    })

    test('devolve INVALID_EMAIL para email inválido', async () => {
      mockRegisterBuyer.mockRejectedValue(
        new RegistrationValidationError(
          'email',
          'Email inválido',
        ),
      )

      const response = await POST(
        createRequest(
          JSON.stringify({
            name: 'Buyer Teste',
            email:
              'email-invalido',
            password:
              'password123',
          }),
        ),
      )

      expect(response.status).toBe(
        400,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Email inválido',
        code: 'INVALID_EMAIL',
      })
    })

    test('devolve INVALID_PASSWORD para password inválida', async () => {
      mockRegisterBuyer.mockRejectedValue(
        new RegistrationValidationError(
          'password',
          'A palavra-passe deve ter pelo menos 8 caracteres',
        ),
      )

      const response = await POST(
        createRequest(
          JSON.stringify({
            name: 'Buyer Teste',
            email:
              'buyer@example.com',
            password: '1234567',
          }),
        ),
      )

      expect(response.status).toBe(
        400,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'A palavra-passe deve ter pelo menos 8 caracteres',
        code: 'INVALID_PASSWORD',
      })
    })

    test('devolve 409 quando o email já está registado', async () => {
      mockRegisterBuyer.mockRejectedValue(
        new RegistrationEmailConflictError(),
      )

      const response = await POST(
        createRequest(
          JSON.stringify({
            name: 'Buyer Teste',
            email:
              'buyer@example.com',
            password:
              'password123',
          }),
        ),
      )

      expect(response.status).toBe(
        409,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Já existe uma conta com este email',
        code:
          'EMAIL_ALREADY_REGISTERED',
      })
    })

    test('cria utilizador e devolve apenas dados públicos', async () => {
      const response = await POST(
        createRequest(
          JSON.stringify({
            name:
              '  Buyer Teste  ',
            email:
              '  Buyer@Example.COM  ',
            password:
              'password123',
          }),
        ),
      )

      expect(response.status).toBe(
        201,
      )

      expect(
        mockRegisterBuyer,
      ).toHaveBeenCalledTimes(1)

      expect(
        mockRegisterBuyer,
      ).toHaveBeenCalledWith({
        name:
          '  Buyer Teste  ',
        email:
          '  Buyer@Example.COM  ',
        password:
          'password123',
      })

      await expect(
        response.json(),
      ).resolves.toEqual({
        user: {
          id: 'user-1',
          email:
            'buyer@example.com',
          name: 'Buyer Teste',
        },
      })
    })

    test('ignora role, isActive e passwordHash enviados pelo cliente', async () => {
      const response = await POST(
        createRequest(
          JSON.stringify({
            name: 'Buyer Teste',
            email:
              'buyer@example.com',
            password:
              'password123',
            role: 'ADMIN',
            isActive: false,
            passwordHash:
              'injetado-pelo-cliente',
          }),
        ),
      )

      expect(response.status).toBe(
        201,
      )

      expect(
        mockRegisterBuyer,
      ).toHaveBeenCalledWith({
        name: 'Buyer Teste',
        email:
          'buyer@example.com',
        password:
          'password123',
      })

      expect(
        mockRegisterBuyer,
      ).not.toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'ADMIN',
        }),
      )

      expect(
        mockRegisterBuyer,
      ).not.toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        }),
      )

      expect(
        mockRegisterBuyer,
      ).not.toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash:
            'injetado-pelo-cliente',
        }),
      )
    })

    test('devolve 500 para erro inesperado sem expor detalhes', async () => {
      const consoleError =
        vi.spyOn(
          console,
          'error',
        ).mockImplementation(
          () => {},
        )

      mockRegisterBuyer.mockRejectedValue(
        new Error(
          'Erro secreto da base de dados',
        ),
      )

      const response = await POST(
        createRequest(
          JSON.stringify({
            name: 'Buyer Teste',
            email:
              'buyer@example.com',
            password:
              'password123',
          }),
        ),
      )

      expect(response.status).toBe(
        500,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Erro interno do servidor',
        code: 'INTERNAL_ERROR',
      })

      expect(
        consoleError,
      ).toHaveBeenCalled()

      consoleError.mockRestore()
    })
  },
)
