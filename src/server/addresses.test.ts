import {
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock(
  './db',
  () => ({
    prisma: {},
  }),
)

import {
  AddressNotFoundError,
  type AddressClient,
  AddressValidationError,
  createUserAddress,
  deleteUserAddress,
  listUserAddresses,
  updateUserAddress,
} from './addresses'

function createAddress(
  overrides: Partial<{
    id: string
    name: string
    addressLine1: string
    addressLine2: string | null
    city: string
    postalCode: string
    country: string
  }> = {},
) {
  return {
    id: 'address-1',
    name: 'Maria Silva',
    addressLine1:
      'Rua Central 10',
    addressLine2: null,
    city: 'Porto',
    postalCode: '4000-001',
    country: 'Portugal',
    ...overrides,
  }
}

function createClient() {
  return {
    address: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  }
}

describe('addresses service', () => {
  test('lista apenas moradas do utilizador indicado', async () => {
    const client = createClient()
    const address = createAddress()

    client.address.findMany
      .mockResolvedValue([
        address,
      ])

    await expect(
      listUserAddresses(
        ' user-1 ',
        client as unknown as AddressClient,
      ),
    ).resolves.toEqual([
      address,
    ])

    expect(
      client.address.findMany,
    ).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
      },
      orderBy: {
        id: 'asc',
      },
      select: {
        id: true,
        name: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        postalCode: true,
        country: true,
      },
    })
  })

  test('rejeita utilizador vazio ao listar', async () => {
    const client = createClient()

    await expect(
      listUserAddresses(
        '   ',
        client as unknown as AddressClient,
      ),
    ).rejects.toMatchObject({
      name: 'AddressValidationError',
      field: 'userId',
    })

    expect(
      client.address.findMany,
    ).not.toHaveBeenCalled()
  })

  test('cria morada normalizada para o utilizador autenticado', async () => {
    const client = createClient()

    const created =
      createAddress()

    client.address.create
      .mockResolvedValue(created)

    await expect(
      createUserAddress(
        ' user-1 ',
        {
          name: ' Maria Silva ',
          addressLine1:
            ' Rua Central 10 ',
          addressLine2: '   ',
          city: ' Porto ',
          postalCode:
            ' 4000-001 ',
          country: ' Portugal ',
        },
        client as unknown as AddressClient,
      ),
    ).resolves.toEqual(created)

    expect(
      client.address.create,
    ).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        name: 'Maria Silva',
        addressLine1:
          'Rua Central 10',
        addressLine2: null,
        city: 'Porto',
        postalCode: '4000-001',
        country: 'Portugal',
      },
      select: {
        id: true,
        name: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        postalCode: true,
        country: true,
      },
    })
  })

  test('não permite que dados extra substituam o proprietário da morada', async () => {
    const client = createClient()

    client.address.create
      .mockResolvedValue(
        createAddress(),
      )

    await createUserAddress(
      'user-1',
      {
        name: 'Maria Silva',
        addressLine1:
          'Rua Central 10',
        addressLine2: null,
        city: 'Porto',
        postalCode: '4000-001',
        country: 'Portugal',
        userId: 'user-2',
        id: 'address-injetado',
      } as {
        name: unknown
        addressLine1: unknown
        addressLine2?: unknown
        city: unknown
        postalCode: unknown
        country: unknown
        userId: string
        id: string
      },
      client as unknown as AddressClient,
    )

    expect(
      client.address.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: 'user-1',
          name: 'Maria Silva',
          addressLine1:
            'Rua Central 10',
          addressLine2: null,
          city: 'Porto',
          postalCode:
            '4000-001',
          country: 'Portugal',
        },
      }),
    )
  })

  test('rejeita campos obrigatórios vazios', async () => {
    const client = createClient()

    await expect(
      createUserAddress(
        'user-1',
        {
          name: '   ',
          addressLine1:
            'Rua Central 10',
          city: 'Porto',
          postalCode: '4000-001',
          country: 'Portugal',
        },
        client as unknown as AddressClient,
      ),
    ).rejects.toBeInstanceOf(
      AddressValidationError,
    )

    await expect(
      createUserAddress(
        'user-1',
        {
          name: 'Maria Silva',
          addressLine1: '   ',
          city: 'Porto',
          postalCode: '4000-001',
          country: 'Portugal',
        },
        client as unknown as AddressClient,
      ),
    ).rejects.toMatchObject({
      field: 'addressLine1',
    })

    expect(
      client.address.create,
    ).not.toHaveBeenCalled()
  })

  test('rejeita complemento da morada com tipo inválido', async () => {
    const client = createClient()

    await expect(
      createUserAddress(
        'user-1',
        {
          name: 'Maria Silva',
          addressLine1:
            'Rua Central 10',
          addressLine2: 123,
          city: 'Porto',
          postalCode: '4000-001',
          country: 'Portugal',
        },
        client as unknown as AddressClient,
      ),
    ).rejects.toMatchObject({
      field: 'addressLine2',
    })

    expect(
      client.address.create,
    ).not.toHaveBeenCalled()
  })

  test('rejeita campos demasiado longos', async () => {
    const client = createClient()

    await expect(
      createUserAddress(
        'user-1',
        {
          name: 'Maria Silva',
          addressLine1:
            'Rua Central 10',
          city: 'Porto',
          postalCode: '4000-001',
          country:
            'P'.repeat(101),
        },
        client as unknown as AddressClient,
      ),
    ).rejects.toMatchObject({
      field: 'country',
    })

    expect(
      client.address.create,
    ).not.toHaveBeenCalled()
  })

  test('atualiza apenas uma morada pertencente ao utilizador', async () => {
    const client = createClient()

    const updatedAddress =
      createAddress({
        city: 'Lisboa',
      })

    client.address.updateMany
      .mockResolvedValue({
        count: 1,
      })

    client.address.findFirst
      .mockResolvedValue(
        updatedAddress,
      )

    await expect(
      updateUserAddress(
        ' user-1 ',
        ' address-1 ',
        {
          name: ' Maria Silva ',
          addressLine1:
            ' Rua Central 10 ',
          addressLine2: null,
          city: ' Lisboa ',
          postalCode:
            ' 1000-001 ',
          country: ' Portugal ',
        },
        client as unknown as AddressClient,
      ),
    ).resolves.toEqual(
      updatedAddress,
    )

    expect(
      client.address.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: 'address-1',
        userId: 'user-1',
      },
      data: {
        name: 'Maria Silva',
        addressLine1:
          'Rua Central 10',
        addressLine2: null,
        city: 'Lisboa',
        postalCode: '1000-001',
        country: 'Portugal',
      },
    })

    expect(
      client.address.findFirst,
    ).toHaveBeenCalledWith({
      where: {
        id: 'address-1',
        userId: 'user-1',
      },
      select: {
        id: true,
        name: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        postalCode: true,
        country: true,
      },
    })
  })

  test('não atualiza morada que não pertence ao utilizador', async () => {
    const client = createClient()

    client.address.updateMany
      .mockResolvedValue({
        count: 0,
      })

    await expect(
      updateUserAddress(
        'user-1',
        'address-user-2',
        {
          name: 'Maria Silva',
          addressLine1:
            'Rua Central 10',
          city: 'Porto',
          postalCode: '4000-001',
          country: 'Portugal',
        },
        client as unknown as AddressClient,
      ),
    ).rejects.toBeInstanceOf(
      AddressNotFoundError,
    )

    expect(
      client.address.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'address-user-2',
          userId: 'user-1',
        },
      }),
    )

    expect(
      client.address.findFirst,
    ).not.toHaveBeenCalled()
  })

  test('trata desaparecimento concorrente durante atualização como morada inexistente', async () => {
    const client = createClient()

    client.address.updateMany
      .mockResolvedValue({
        count: 1,
      })

    client.address.findFirst
      .mockResolvedValue(null)

    await expect(
      updateUserAddress(
        'user-1',
        'address-1',
        {
          name: 'Maria Silva',
          addressLine1:
            'Rua Central 10',
          city: 'Porto',
          postalCode: '4000-001',
          country: 'Portugal',
        },
        client as unknown as AddressClient,
      ),
    ).rejects.toBeInstanceOf(
      AddressNotFoundError,
    )
  })

  test('apaga apenas morada pertencente ao utilizador', async () => {
    const client = createClient()

    client.address.deleteMany
      .mockResolvedValue({
        count: 1,
      })

    await expect(
      deleteUserAddress(
        ' user-1 ',
        ' address-1 ',
        client as unknown as AddressClient,
      ),
    ).resolves.toBeUndefined()

    expect(
      client.address.deleteMany,
    ).toHaveBeenCalledWith({
      where: {
        id: 'address-1',
        userId: 'user-1',
      },
    })
  })

  test('não apaga morada de outro utilizador', async () => {
    const client = createClient()

    client.address.deleteMany
      .mockResolvedValue({
        count: 0,
      })

    await expect(
      deleteUserAddress(
        'user-1',
        'address-user-2',
        client as unknown as AddressClient,
      ),
    ).rejects.toBeInstanceOf(
      AddressNotFoundError,
    )

    expect(
      client.address.deleteMany,
    ).toHaveBeenCalledWith({
      where: {
        id: 'address-user-2',
        userId: 'user-1',
      },
    })
  })

  test('rejeita id de morada vazio antes de consultar a base de dados', async () => {
    const client = createClient()

    await expect(
      deleteUserAddress(
        'user-1',
        '   ',
        client as unknown as AddressClient,
      ),
    ).rejects.toMatchObject({
      field: 'addressId',
    })

    expect(
      client.address.deleteMany,
    ).not.toHaveBeenCalled()
  })
})
