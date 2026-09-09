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

    return {
      getServerSession:
        vi.fn(),
      listUserAddresses:
        vi.fn(),
      createUserAddress:
        vi.fn(),
      updateUserAddress:
        vi.fn(),
      deleteUserAddress:
        vi.fn(),
      AddressValidationError,
      AddressNotFoundError,
    }
  },
)

vi.mock(
  'next-auth',
  () => ({
    getServerSession:
      mocks.getServerSession,
  }),
)

vi.mock(
  '@/server/auth',
  () => ({
    authOptions: {},
  }),
)

vi.mock(
  '@/server/addresses',
  () => ({
    AddressValidationError:
      mocks.AddressValidationError,
    AddressNotFoundError:
      mocks.AddressNotFoundError,
    listUserAddresses:
      mocks.listUserAddresses,
    createUserAddress:
      mocks.createUserAddress,
    updateUserAddress:
      mocks.updateUserAddress,
    deleteUserAddress:
      mocks.deleteUserAddress,
  }),
)

import {
  DELETE,
  GET,
  PATCH,
  POST,
} from './route'

function authenticatedSession() {
  return {
    user: {
      id: ' user-1 ',
      name: 'Maria',
      email:
        'maria@example.com',
      role: 'BUYER',
    },
  }
}

function createAddress() {
  return {
    id: 'address-1',
    name: 'Maria Silva',
    addressLine1:
      'Rua Central 10',
    addressLine2: null,
    city: 'Porto',
    postalCode: '4000-001',
    country: 'Portugal',
  }
}

function jsonRequest(
  method: string,
  body: unknown,
) {
  return new Request(
    'http://localhost/api/addresses',
    {
      method,
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify(
        body,
      ),
    },
  )
}

function invalidJsonRequest(
  method: string,
) {
  return new Request(
    'http://localhost/api/addresses',
    {
      method,
      headers: {
        'Content-Type':
          'application/json',
      },
      body: '{',
    },
  )
}

describe('/api/addresses', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.getServerSession
      .mockResolvedValue(
        authenticatedSession(),
      )
  })

  test('GET devolve 401 sem sessão', async () => {
    mocks.getServerSession
      .mockResolvedValue(null)

    const response =
      await GET()

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
      mocks.listUserAddresses,
    ).not.toHaveBeenCalled()
  })

  test('GET lista apenas moradas do utilizador autenticado', async () => {
    const address =
      createAddress()

    mocks.listUserAddresses
      .mockResolvedValue([
        address,
      ])

    const response =
      await GET()

    expect(
      response.status,
    ).toBe(200)

    await expect(
      response.json(),
    ).resolves.toEqual({
      addresses: [
        address,
      ],
    })

    expect(
      mocks.listUserAddresses,
    ).toHaveBeenCalledWith(
      'user-1',
    )
  })

  test('GET devolve 500 genérico em erro inesperado', async () => {
    mocks.listUserAddresses
      .mockRejectedValue(
        new Error('erro'),
      )

    const response =
      await GET()

    expect(
      response.status,
    ).toBe(500)

    await expect(
      response.json(),
    ).resolves.toEqual({
      error:
        'Erro interno do servidor',
    })
  })

  test('POST devolve 401 sem sessão', async () => {
    mocks.getServerSession
      .mockResolvedValue(null)

    const response =
      await POST(
        jsonRequest(
          'POST',
          {},
        ),
      )

    expect(
      response.status,
    ).toBe(401)

    expect(
      mocks.createUserAddress,
    ).not.toHaveBeenCalled()
  })

  test('POST rejeita JSON inválido', async () => {
    const response =
      await POST(
        invalidJsonRequest(
          'POST',
        ),
      )

    expect(
      response.status,
    ).toBe(400)

    await expect(
      response.json(),
    ).resolves.toEqual({
      error:
        'JSON inválido',
    })
  })

  test('POST rejeita corpo que não seja objeto', async () => {
    const response =
      await POST(
        jsonRequest(
          'POST',
          [],
        ),
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
  })

  test('POST cria morada para o utilizador autenticado e ignora proprietário enviado pelo cliente', async () => {
    const address =
      createAddress()

    mocks.createUserAddress
      .mockResolvedValue(
        address,
      )

    const response =
      await POST(
        jsonRequest(
          'POST',
          {
            name:
              'Maria Silva',
            addressLine1:
              'Rua Central 10',
            addressLine2:
              null,
            city: 'Porto',
            postalCode:
              '4000-001',
            country:
              'Portugal',
            userId:
              'user-atacante',
            id:
              'address-atacante',
          },
        ),
      )

    expect(
      response.status,
    ).toBe(201)

    await expect(
      response.json(),
    ).resolves.toEqual({
      address,
    })

    expect(
      mocks.createUserAddress,
    ).toHaveBeenCalledWith(
      'user-1',
      {
        name:
          'Maria Silva',
        addressLine1:
          'Rua Central 10',
        addressLine2:
          null,
        city: 'Porto',
        postalCode:
          '4000-001',
        country:
          'Portugal',
      },
    )
  })

  test('POST devolve 400 para validação da morada', async () => {
    mocks.createUserAddress
      .mockRejectedValue(
        new mocks.AddressValidationError(
          'city',
          'Localidade é obrigatória',
        ),
      )

    const response =
      await POST(
        jsonRequest(
          'POST',
          {
            name:
              'Maria Silva',
          },
        ),
      )

    expect(
      response.status,
    ).toBe(400)

    await expect(
      response.json(),
    ).resolves.toEqual({
      error:
        'Localidade é obrigatória',
    })
  })

  test('PATCH rejeita id de morada com tipo inválido', async () => {
    const response =
      await PATCH(
        jsonRequest(
          'PATCH',
          {
            addressId: 123,
          },
        ),
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
      mocks.updateUserAddress,
    ).not.toHaveBeenCalled()
  })

  test('PATCH atualiza morada dentro da conta autenticada', async () => {
    const address =
      createAddress()

    mocks.updateUserAddress
      .mockResolvedValue(
        address,
      )

    const response =
      await PATCH(
        jsonRequest(
          'PATCH',
          {
            addressId:
              'address-1',
            name:
              'Maria Silva',
            addressLine1:
              'Rua Central 10',
            addressLine2:
              null,
            city: 'Porto',
            postalCode:
              '4000-001',
            country:
              'Portugal',
            userId:
              'user-atacante',
          },
        ),
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
      mocks.updateUserAddress,
    ).toHaveBeenCalledWith(
      'user-1',
      'address-1',
      {
        name:
          'Maria Silva',
        addressLine1:
          'Rua Central 10',
        addressLine2:
          null,
        city: 'Porto',
        postalCode:
          '4000-001',
        country:
          'Portugal',
      },
    )
  })

  test('PATCH devolve 404 quando a morada não pertence ao utilizador', async () => {
    mocks.updateUserAddress
      .mockRejectedValue(
        new mocks.AddressNotFoundError(),
      )

    const response =
      await PATCH(
        jsonRequest(
          'PATCH',
          {
            addressId:
              'address-user-2',
            name:
              'Maria Silva',
            addressLine1:
              'Rua Central 10',
            city: 'Porto',
            postalCode:
              '4000-001',
            country:
              'Portugal',
          },
        ),
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
  })

  test('DELETE rejeita id de morada com tipo inválido', async () => {
    const response =
      await DELETE(
        jsonRequest(
          'DELETE',
          {
            addressId: null,
          },
        ),
      )

    expect(
      response.status,
    ).toBe(400)

    expect(
      mocks.deleteUserAddress,
    ).not.toHaveBeenCalled()
  })

  test('DELETE apaga morada apenas dentro da conta autenticada', async () => {
    mocks.deleteUserAddress
      .mockResolvedValue(
        undefined,
      )

    const response =
      await DELETE(
        jsonRequest(
          'DELETE',
          {
            addressId:
              'address-1',
          },
        ),
      )

    expect(
      response.status,
    ).toBe(204)

    expect(
      mocks.deleteUserAddress,
    ).toHaveBeenCalledWith(
      'user-1',
      'address-1',
    )
  })

  test('DELETE devolve 404 quando a morada não pertence ao utilizador', async () => {
    mocks.deleteUserAddress
      .mockRejectedValue(
        new mocks.AddressNotFoundError(),
      )

    const response =
      await DELETE(
        jsonRequest(
          'DELETE',
          {
            addressId:
              'address-user-2',
          },
        ),
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
  })
})
