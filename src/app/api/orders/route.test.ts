import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(
  () => {
    class OrderValidationError
      extends Error {
      constructor(
        public readonly field:
          string,
        message: string,
      ) {
        super(message)
        this.name =
          'OrderValidationError'
      }
    }

    return {
      getServerSession:
        vi.fn(),
      listUserOrders:
        vi.fn(),
      OrderValidationError,
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
  '@/server/orders',
  () => ({
    OrderValidationError:
      mocks.OrderValidationError,
    listUserOrders:
      mocks.listUserOrders,
  }),
)

import { GET } from './route'

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

function createOrder() {
  return {
    id: 'order-1',
    orderNumber:
      'PFA-ABC123',
    subtotal: '100.00',
    shippingCost: '5.50',
    tax: '23.00',
    total: '128.50',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    shippingName:
      'Maria Silva',
    shippingEmail:
      'maria@example.com',
    shippingPhone:
      '910000000',
    shippingAddressLine1:
      'Rua Central 10',
    shippingAddressLine2:
      null,
    shippingCity:
      'Porto',
    shippingPostalCode:
      '4000-001',
    shippingCountry:
      'Portugal',
    createdAt:
      new Date(
        '2026-09-01T10:00:00.000Z',
      ),
    items: [
      {
        id: 'item-1',
        productNameAtPurchase:
          'Filtro de óleo',
        productSkuAtPurchase:
          'FLT-001',
        priceAtPurchase:
          '50.00',
        quantity: 2,
        subtotalAtPurchase:
          '100.00',
      },
    ],
  }
}

describe('/api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.getServerSession
      .mockResolvedValue(
        authenticatedSession(),
      )
  })

  test('devolve 401 sem sessão', async () => {
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
      mocks.listUserOrders,
    ).not.toHaveBeenCalled()
  })

  test('devolve 401 quando a sessão não tem utilizador válido', async () => {
    mocks.getServerSession
      .mockResolvedValue({
        user: {
          id: '   ',
        },
      })

    const response =
      await GET()

    expect(
      response.status,
    ).toBe(401)

    expect(
      mocks.listUserOrders,
    ).not.toHaveBeenCalled()
  })

  test('lista apenas encomendas do utilizador autenticado', async () => {
    const order =
      createOrder()

    mocks.listUserOrders
      .mockResolvedValue([
        order,
      ])

    const response =
      await GET()

    expect(
      response.status,
    ).toBe(200)

    expect(
      mocks.listUserOrders,
    ).toHaveBeenCalledWith(
      'user-1',
    )

    await expect(
      response.json(),
    ).resolves.toEqual({
      orders: [
        {
          ...order,
          createdAt:
            '2026-09-01T10:00:00.000Z',
        },
      ],
    })
  })

  test('devolve 400 para erro de validação do serviço', async () => {
    mocks.listUserOrders
      .mockRejectedValue(
        new mocks.OrderValidationError(
          'userId',
          'Utilizador inválido',
        ),
      )

    const response =
      await GET()

    expect(
      response.status,
    ).toBe(400)

    await expect(
      response.json(),
    ).resolves.toEqual({
      error:
        'Utilizador inválido',
    })
  })

  test('devolve 500 genérico em erro inesperado', async () => {
    mocks.listUserOrders
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
})
