import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(
  () => {
    class CheckoutValidationError
      extends Error {
      constructor(message: string) {
        super(message)
        this.name =
          'CheckoutValidationError'
      }
    }

    class CheckoutUserUnavailableError
      extends Error {
      constructor(
        message =
          'Utilizador indisponível',
      ) {
        super(message)
        this.name =
          'CheckoutUserUnavailableError'
      }
    }

    class CheckoutEmptyCartError
      extends Error {
      constructor(
        message =
          'O carrinho está vazio',
      ) {
        super(message)
        this.name =
          'CheckoutEmptyCartError'
      }
    }

    class CheckoutProductUnavailableError
      extends Error {
      constructor(
        message =
          'Existe um produto indisponível no carrinho',
      ) {
        super(message)
        this.name =
          'CheckoutProductUnavailableError'
      }
    }

    class CheckoutInsufficientStockError
      extends Error {
      constructor(
        message =
          'Existe stock insuficiente para um produto do carrinho',
      ) {
        super(message)
        this.name =
          'CheckoutInsufficientStockError'
      }
    }

    class CheckoutCartChangedError
      extends Error {
      constructor(
        message =
          'O carrinho ou o stock foi alterado durante o checkout',
      ) {
        super(message)
        this.name =
          'CheckoutCartChangedError'
      }
    }

    class CheckoutPricingError
      extends Error {
      constructor(
        message =
          'Configuração de preços do checkout inválida',
      ) {
        super(message)
        this.name =
          'CheckoutPricingError'
      }
    }

    return {
      getServerSession:
        vi.fn(),
      createCheckoutOrder:
        vi.fn(),
      CheckoutValidationError,
      CheckoutUserUnavailableError,
      CheckoutEmptyCartError,
      CheckoutProductUnavailableError,
      CheckoutInsufficientStockError,
      CheckoutCartChangedError,
      CheckoutPricingError,
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
  '@/server/checkout',
  () => ({
    createCheckoutOrder:
      mocks.createCheckoutOrder,
    CheckoutValidationError:
      mocks.CheckoutValidationError,
    CheckoutUserUnavailableError:
      mocks.CheckoutUserUnavailableError,
    CheckoutEmptyCartError:
      mocks.CheckoutEmptyCartError,
    CheckoutProductUnavailableError:
      mocks.CheckoutProductUnavailableError,
    CheckoutInsufficientStockError:
      mocks.CheckoutInsufficientStockError,
    CheckoutCartChangedError:
      mocks.CheckoutCartChangedError,
    CheckoutPricingError:
      mocks.CheckoutPricingError,
  }),
)

import { POST } from './route'

function authenticatedSession() {
  return {
    user: {
      id: ' user-1 ',
      name: 'Maria',
      email:
        'maria@example.com',
      role: 'BUYER',
    },
    expires:
      '2099-01-01T00:00:00.000Z',
  }
}

function createShipping() {
  return {
    name: 'Maria Silva',
    phone: '910000000',
    addressLine1:
      'Rua Central 10',
    addressLine2: null,
    city: 'Porto',
    postalCode: '4000-001',
    country: 'Portugal',
    region:
      'PORTUGAL_MAINLAND',
  }
}

function createOrder() {
  return {
    id: 'order-1',
    orderNumber:
      'PFA-ABC123',
    subtotal: 100,
    shippingCost: 5.9,
    tax: 19.8,
    total: 105.9,
    status: 'PENDING',
    paymentStatus: 'UNPAID',
  }
}

function createRequest(
  body: string,
) {
  return new Request(
    'http://localhost/api/checkout',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json',
      },
      body,
    },
  )
}

describe('/api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.getServerSession
      .mockReset()

    mocks.createCheckoutOrder
      .mockReset()

    mocks.getServerSession
      .mockResolvedValue(
        authenticatedSession(),
      )
  })

  test(
    'devolve 401 quando utilizador não está autenticado',
    async () => {
      mocks.getServerSession
        .mockResolvedValue(null)

      const response =
        await POST(
          createRequest(
            JSON.stringify({
              shipping:
                createShipping(),
            }),
          ),
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
        mocks.createCheckoutOrder,
      ).not.toHaveBeenCalled()
    },
  )

  test(
    'devolve 401 quando a sessão não tem utilizador válido',
    async () => {
      mocks.getServerSession
        .mockResolvedValue({
          user: {
            id: '   ',
          },
        })

      const response =
        await POST(
          createRequest(
            JSON.stringify({
              shipping:
                createShipping(),
            }),
          ),
        )

      expect(
        response.status,
      ).toBe(401)

      expect(
        mocks.createCheckoutOrder,
      ).not.toHaveBeenCalled()
    },
  )

  test(
    'rejeita JSON inválido',
    async () => {
      const response =
        await POST(
          createRequest('{'),
        )

      expect(
        response.status,
      ).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'JSON inválido',
      })

      expect(
        mocks.createCheckoutOrder,
      ).not.toHaveBeenCalled()
    },
  )

  test(
    'rejeita corpo que não é objeto',
    async () => {
      const response =
        await POST(
          createRequest(
            JSON.stringify([]),
          ),
        )

      expect(
        response.status,
      ).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Pedido inválido',
      })

      expect(
        mocks.createCheckoutOrder,
      ).not.toHaveBeenCalled()
    },
  )

  test(
    'rejeita pedido sem dados de entrega',
    async () => {
      const response =
        await POST(
          createRequest(
            JSON.stringify({}),
          ),
        )

      expect(
        response.status,
      ).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Dados de entrega inválidos',
      })

      expect(
        mocks.createCheckoutOrder,
      ).not.toHaveBeenCalled()
    },
  )

  test(
    'rejeita campo obrigatório de entrega com tipo inválido',
    async () => {
      const response =
        await POST(
          createRequest(
            JSON.stringify({
              shipping: {
                ...createShipping(),
                phone: 910000000,
              },
            }),
          ),
        )

      expect(
        response.status,
      ).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Dados de entrega inválidos',
      })

      expect(
        mocks.createCheckoutOrder,
      ).not.toHaveBeenCalled()
    },
  )

  test(
    'rejeita complemento de morada com tipo inválido',
    async () => {
      const response =
        await POST(
          createRequest(
            JSON.stringify({
              shipping: {
                ...createShipping(),
                addressLine2: 123,
              },
            }),
          ),
        )

      expect(
        response.status,
      ).toBe(400)

      expect(
        mocks.createCheckoutOrder,
      ).not.toHaveBeenCalled()
    },
  )

  test(
    'cria encomenda para o utilizador autenticado',
    async () => {
      const shipping =
        createShipping()

      const order =
        createOrder()

      mocks.createCheckoutOrder
        .mockResolvedValue(
          order,
        )

      const response =
        await POST(
          createRequest(
            JSON.stringify({
              shipping,
            }),
          ),
        )

      expect(
        response.status,
      ).toBe(201)

      expect(
        mocks.createCheckoutOrder,
      ).toHaveBeenCalledTimes(1)

      expect(
        mocks.createCheckoutOrder,
      ).toHaveBeenCalledWith(
        'user-1',
        shipping,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        order,
      })
    },
  )

  test(
    'aceita complemento de morada omitido',
    async () => {
      const shipping = {
        name: 'Maria Silva',
        phone: '910000000',
        addressLine1:
          'Rua Central 10',
        city: 'Porto',
        postalCode: '4000-001',
        country: 'Portugal',
        region:
          'PORTUGAL_MAINLAND',
      }

      mocks.createCheckoutOrder
        .mockResolvedValue(
          createOrder(),
        )

      const response =
        await POST(
          createRequest(
            JSON.stringify({
              shipping,
            }),
          ),
        )

      expect(
        response.status,
      ).toBe(201)

      expect(
        mocks.createCheckoutOrder,
      ).toHaveBeenCalledWith(
        'user-1',
        {
          ...shipping,
          addressLine2:
            undefined,
        },
      )
    },
  )

  test(
    'devolve 400 para erro de validação do checkout',
    async () => {
      mocks.createCheckoutOrder
        .mockRejectedValue(
          new mocks.CheckoutValidationError(
            'Código postal inválido',
          ),
        )

      const response =
        await POST(
          createRequest(
            JSON.stringify({
              shipping:
                createShipping(),
            }),
          ),
        )

      expect(
        response.status,
      ).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Código postal inválido',
      })
    },
  )

  test(
    'devolve 403 quando o utilizador autenticado deixou de estar disponível',
    async () => {
      mocks.createCheckoutOrder
        .mockRejectedValue(
          new mocks.CheckoutUserUnavailableError(),
        )

      const response =
        await POST(
          createRequest(
            JSON.stringify({
              shipping:
                createShipping(),
            }),
          ),
        )

      expect(
        response.status,
      ).toBe(403)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Utilizador indisponível',
      })
    },
  )

  test.each([
    [
      'carrinho vazio',
      new mocks.CheckoutEmptyCartError(),
      'O carrinho está vazio',
    ],
    [
      'produto indisponível',
      new mocks.CheckoutProductUnavailableError(),
      'Existe um produto indisponível no carrinho',
    ],
    [
      'stock insuficiente',
      new mocks.CheckoutInsufficientStockError(),
      'Existe stock insuficiente para um produto do carrinho',
    ],
    [
      'carrinho alterado',
      new mocks.CheckoutCartChangedError(),
      'O carrinho ou o stock foi alterado durante o checkout',
    ],
    [
      'configuração de preços inválida',
      new mocks.CheckoutPricingError(),
      'Configuração de preços do checkout inválida',
    ],
  ])(
    'devolve 409 para %s',
    async (
      _description,
      error,
      expectedMessage,
    ) => {
      mocks.createCheckoutOrder
        .mockRejectedValue(
          error,
        )

      const response =
        await POST(
          createRequest(
            JSON.stringify({
              shipping:
                createShipping(),
            }),
          ),
        )

      expect(
        response.status,
      ).toBe(409)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: expectedMessage,
      })
    },
  )

  test(
    'devolve 500 genérico para erro inesperado',
    async () => {
      const consoleError =
        vi.spyOn(
          console,
          'error',
        ).mockImplementation(
          () => {},
        )

      mocks.createCheckoutOrder
        .mockRejectedValue(
          new Error(
            'Erro inesperado',
          ),
        )

      const response =
        await POST(
          createRequest(
            JSON.stringify({
              shipping:
                createShipping(),
            }),
          ),
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
        'Unexpected checkout API error:',
        expect.any(Error),
      )

      consoleError.mockRestore()
    },
  )
})
