import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(
  () => {
    class AddressValidationError
      extends Error {
      constructor(
        public readonly field:
          string,
        message: string,
      ) {
        super(message)
        this.name =
          'AddressValidationError'
      }
    }

    class AddressNotFoundError
      extends Error {
      constructor(
        message =
          'Morada não encontrada',
      ) {
        super(message)
        this.name =
          'AddressNotFoundError'
      }
    }

    class UnauthorizedUserError
      extends Error {
      constructor(
        message =
          'Não autenticado',
      ) {
        super(message)
        this.name =
          'UnauthorizedUserError'
      }
    }

    return {
      requireActiveUserId:
        vi.fn(),
      setDefaultUserAddress:
        vi.fn(),
      AddressValidationError,
      AddressNotFoundError,
      UnauthorizedUserError,
    }
  },
)

vi.mock(
  '@/server/user-auth',
  () => ({
    requireActiveUserId:
      mocks.requireActiveUserId,
    UnauthorizedUserError:
      mocks.UnauthorizedUserError,
  }),
)

vi.mock(
  '@/server/addresses',
  () => ({
    AddressValidationError:
      mocks.AddressValidationError,
    AddressNotFoundError:
      mocks.AddressNotFoundError,
    setDefaultUserAddress:
      mocks.setDefaultUserAddress,
  }),
)

import { PATCH } from './route'

function createAddress() {
  return {
    id: 'address-2',
    name: 'João Silva',
    addressLine1:
      'Rua Nova 20',
    addressLine2: null,
    city: 'Braga',
    postalCode: '4700-001',
    country: 'Portugal',
    isDefault: true,
  }
}

function jsonRequest(
  body: unknown,
) {
  return new Request(
    'http://localhost/api/addresses/default',
    {
      method: 'PATCH',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

function invalidJsonRequest() {
  return new Request(
    'http://localhost/api/addresses/default',
    {
      method: 'PATCH',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: '{',
    },
  )
}

function oversizedJsonRequest() {
  return new Request(
    'http://localhost/api/addresses/default',
    {
      method: 'PATCH',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify({
        padding:
          'x'.repeat(
            70 * 1024,
          ),
      }),
    },
  )
}

describe(
  '/api/addresses/default',
  () => {
    beforeEach(() => {
      vi.resetAllMocks()

      mocks.requireActiveUserId
        .mockResolvedValue(
          'user-1',
        )
    })

    test(
      'devolve 401 quando o utilizador não está autenticado ou ativo',
      async () => {
        mocks.requireActiveUserId
          .mockRejectedValue(
            new mocks
              .UnauthorizedUserError(),
          )

        const response =
          await PATCH(
            jsonRequest({
              addressId:
                'address-2',
            }),
          )

        expect(
          response.status,
        ).toBe(401)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Não autenticado',
        })

        expect(
          mocks.setDefaultUserAddress,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita JSON inválido',
      async () => {
        const response =
          await PATCH(
            invalidJsonRequest(),
          )

        expect(
          response.status,
        ).toBe(400)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error: 'JSON inválido',
        })
      },
    )

    test(
      'rejeita payload demasiado grande',
      async () => {
        const response =
          await PATCH(
            oversizedJsonRequest(),
          )

        expect(
          response.status,
        ).toBe(413)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Pedido demasiado grande',
        })

        expect(
          mocks.setDefaultUserAddress,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita corpo que não seja objeto',
      async () => {
        const response =
          await PATCH(
            jsonRequest([]),
          )

        expect(
          response.status,
        ).toBe(400)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Pedido inválido',
        })
      },
    )

    test(
      'rejeita id de morada com tipo inválido',
      async () => {
        const response =
          await PATCH(
            jsonRequest({
              addressId: 123,
            }),
          )

        expect(
          response.status,
        ).toBe(400)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Morada inválida',
        })

        expect(
          mocks.setDefaultUserAddress,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'define a morada predefinida apenas dentro da conta autenticada',
      async () => {
        const address =
          createAddress()

        mocks.setDefaultUserAddress
          .mockResolvedValue(
            address,
          )

        const response =
          await PATCH(
            jsonRequest({
              addressId:
                'address-2',
              userId:
                'user-atacante',
            }),
          )

        expect(
          response.status,
        ).toBe(200)

        await expect(
          response.json(),
        ).resolves.toEqual({
          address,
        })

        expect(
          mocks.setDefaultUserAddress,
        ).toHaveBeenCalledWith(
          'user-1',
          'address-2',
        )
      },
    )

    test(
      'devolve 404 quando a morada não pertence ao utilizador',
      async () => {
        mocks.setDefaultUserAddress
          .mockRejectedValue(
            new mocks
              .AddressNotFoundError(),
          )

        const response =
          await PATCH(
            jsonRequest({
              addressId:
                'address-user-2',
            }),
          )

        expect(
          response.status,
        ).toBe(404)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Morada não encontrada',
        })
      },
    )

    test(
      'devolve 400 para id vazio validado pelo serviço',
      async () => {
        mocks.setDefaultUserAddress
          .mockRejectedValue(
            new mocks
              .AddressValidationError(
                'addressId',
                'Morada é obrigatória',
              ),
          )

        const response =
          await PATCH(
            jsonRequest({
              addressId: '   ',
            }),
          )

        expect(
          response.status,
        ).toBe(400)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Morada é obrigatória',
        })
      },
    )

    test(
      'devolve 500 genérico em erro inesperado',
      async () => {
        const consoleError =
          vi.spyOn(
            console,
            'error',
          ).mockImplementation(
            () => {},
          )

        mocks.setDefaultUserAddress
          .mockRejectedValue(
            new Error('erro'),
          )

        const response =
          await PATCH(
            jsonRequest({
              addressId:
                'address-2',
            }),
          )

        expect(
          response.status,
        ).toBe(500)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Erro interno do servidor',
        })

        expect(
          consoleError,
        ).toHaveBeenCalledWith(
          'Unexpected default address API error:',
          expect.any(Error),
        )

        consoleError.mockRestore()
      },
    )
  },
)
