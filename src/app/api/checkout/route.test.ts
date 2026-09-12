import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => {
  class UnauthorizedUserError extends Error {
    constructor(message = 'Não autenticado') {
      super(message)
      this.name = 'UnauthorizedUserError'
    }
  }

  class CheckoutValidationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'CheckoutValidationError'
    }
  }

  class CheckoutUserUnavailableError extends Error {
    constructor(message = 'Utilizador indisponível') {
      super(message)
      this.name = 'CheckoutUserUnavailableError'
    }
  }

  class CheckoutEmptyCartError extends Error {
    constructor(message = 'O carrinho está vazio') {
      super(message)
      this.name = 'CheckoutEmptyCartError'
    }
  }

  class CheckoutProductUnavailableError extends Error {
    constructor(message = 'Existe um produto indisponível no carrinho') {
      super(message)
      this.name = 'CheckoutProductUnavailableError'
    }
  }

  class CheckoutInsufficientStockError extends Error {
    constructor(message = 'Existe stock insuficiente para um produto do carrinho') {
      super(message)
      this.name = 'CheckoutInsufficientStockError'
    }
  }

  class CheckoutCartChangedError extends Error {
    constructor(message = 'O carrinho ou o stock foi alterado durante o checkout') {
      super(message)
      this.name = 'CheckoutCartChangedError'
    }
  }

  class CheckoutPricingError extends Error {
    constructor(message = 'Configuração de preços do checkout inválida') {
      super(message)
      this.name = 'CheckoutPricingError'
    }
  }

  class CheckoutPreviewChangedError extends Error {
    constructor(message = 'O checkout foi alterado. Calcula novamente o total antes de criar a encomenda.') {
      super(message)
      this.name = 'CheckoutPreviewChangedError'
    }
  }

  return {
    requireActiveUserId: vi.fn(),
    createCheckoutOrder: vi.fn(),
    UnauthorizedUserError,
    CheckoutValidationError,
    CheckoutUserUnavailableError,
    CheckoutEmptyCartError,
    CheckoutProductUnavailableError,
    CheckoutInsufficientStockError,
    CheckoutCartChangedError,
    CheckoutPricingError,
    CheckoutPreviewChangedError,
  }
})

vi.mock('@/server/user-auth', () => ({
  requireActiveUserId: mocks.requireActiveUserId,
  UnauthorizedUserError: mocks.UnauthorizedUserError,
}))

vi.mock('@/server/checkout', () => ({
  createCheckoutOrder: mocks.createCheckoutOrder,
  CheckoutValidationError: mocks.CheckoutValidationError,
  CheckoutUserUnavailableError: mocks.CheckoutUserUnavailableError,
  CheckoutEmptyCartError: mocks.CheckoutEmptyCartError,
  CheckoutProductUnavailableError: mocks.CheckoutProductUnavailableError,
  CheckoutInsufficientStockError: mocks.CheckoutInsufficientStockError,
  CheckoutCartChangedError: mocks.CheckoutCartChangedError,
  CheckoutPricingError: mocks.CheckoutPricingError,
  CheckoutPreviewChangedError: mocks.CheckoutPreviewChangedError,
}))

import { POST } from './route'

const validFingerprint = 'ab'.repeat(32)

function createShipping() {
  return {
    name: 'Maria Silva',
    phone: '910000000',
    addressLine1: 'Rua Central 10',
    addressLine2: null,
    city: 'Porto',
    postalCode: '4000-001',
    country: 'Portugal',
    region: 'PORTUGAL_MAINLAND',
  }
}

function createPickupContact() {
  return {
    name: 'Maria Silva',
    phone: '910000000',
  }
}

function createOrder(
  fulfillmentMethod: 'DELIVERY' | 'PICKUP' = 'DELIVERY',
) {
  return {
    id: 'order-1',
    orderNumber: 'PFA-ABC123',
    fulfillmentMethod,
    subtotal: 100,
    shippingCost: fulfillmentMethod === 'PICKUP' ? 0 : 5.9,
    tax: 19.8,
    total: fulfillmentMethod === 'PICKUP' ? 100 : 105.9,
    status: 'PENDING',
    paymentStatus: 'UNPAID',
  }
}

function createRequest(body: string) {
  return new Request(
    'http://localhost/api/checkout',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body,
    },
  )
}

function deliveryBody(
  overrides: Record<string, unknown> = {},
) {
  return {
    fulfillmentMethod: 'DELIVERY',
    shipping: createShipping(),
    expectedFingerprint: validFingerprint,
    ...overrides,
  }
}

function pickupBody(
  overrides: Record<string, unknown> = {},
) {
  return {
    fulfillmentMethod: 'PICKUP',
    shipping: createPickupContact(),
    expectedFingerprint: validFingerprint,
    ...overrides,
  }
}

describe('/api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireActiveUserId.mockResolvedValue('user-1')
    mocks.createCheckoutOrder.mockResolvedValue(createOrder())
  })

  test('devolve 401 quando a sessão não corresponde a um utilizador ativo', async () => {
    mocks.requireActiveUserId.mockRejectedValue(
      new mocks.UnauthorizedUserError(),
    )

    const response = await POST(
      createRequest(JSON.stringify(deliveryBody())),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'Não autenticado',
      code: 'UNAUTHENTICATED',
    })
    expect(mocks.createCheckoutOrder).not.toHaveBeenCalled()
  })

  test('rejeita JSON inválido', async () => {
    const response = await POST(createRequest('{'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'JSON inválido',
      code: 'INVALID_JSON',
    })
    expect(mocks.createCheckoutOrder).not.toHaveBeenCalled()
  })

  test('rejeita payload superior a 32 KiB', async () => {
    const response = await POST(
      createRequest(
        JSON.stringify({
          fulfillmentMethod: 'DELIVERY',
          padding: 'x'.repeat(40 * 1024),
        }),
      ),
    )

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({
      error: 'Pedido demasiado grande',
      code: 'PAYLOAD_TOO_LARGE',
    })
    expect(mocks.createCheckoutOrder).not.toHaveBeenCalled()
  })

  test('rejeita corpo que não é objeto', async () => {
    const response = await POST(
      createRequest(JSON.stringify([])),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Pedido inválido',
      code: 'INVALID_REQUEST',
    })
  })

  test.each([
    undefined,
    null,
    '',
    'STORE',
  ])('rejeita método de entrega inválido %j', async (fulfillmentMethod) => {
    const response = await POST(
      createRequest(
        JSON.stringify(
          deliveryBody({ fulfillmentMethod }),
        ),
      ),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Método de entrega inválido',
      code: 'INVALID_FULFILLMENT_METHOD',
    })
    expect(mocks.createCheckoutOrder).not.toHaveBeenCalled()
  })

  test('rejeita DELIVERY sem morada completa', async () => {
    const response = await POST(
      createRequest(
        JSON.stringify(
          deliveryBody({
            shipping: {
              name: 'Maria Silva',
              phone: '910000000',
            },
          }),
        ),
      ),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Dados de entrega inválidos',
      code: 'INVALID_SHIPPING',
    })
  })

  test('rejeita PICKUP sem contacto completo', async () => {
    const response = await POST(
      createRequest(
        JSON.stringify(
          pickupBody({
            shipping: {
              name: 'Maria Silva',
            },
          }),
        ),
      ),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Dados para levantamento inválidos',
      code: 'INVALID_SHIPPING',
    })
  })

  test('rejeita complemento de morada DELIVERY com tipo inválido', async () => {
    const response = await POST(
      createRequest(
        JSON.stringify(
          deliveryBody({
            shipping: {
              ...createShipping(),
              addressLine2: 123,
            },
          }),
        ),
      ),
    )

    expect(response.status).toBe(400)
  })

  test.each([
    undefined,
    null,
    '',
    'a'.repeat(63),
    'A'.repeat(64),
    'g'.repeat(64),
  ])('rejeita fingerprint inválido %j', async (expectedFingerprint) => {
    const response = await POST(
      createRequest(
        JSON.stringify(
          deliveryBody({ expectedFingerprint }),
        ),
      ),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Referência de preview inválida. Calcula novamente o total.',
      code: 'INVALID_FINGERPRINT',
    })
    expect(mocks.createCheckoutOrder).not.toHaveBeenCalled()
  })

  test('cria DELIVERY apenas com os campos autorizados pelo servidor', async () => {
    const order = createOrder('DELIVERY')
    mocks.createCheckoutOrder.mockResolvedValue(order)

    const response = await POST(
      createRequest(
        JSON.stringify({
          ...deliveryBody(),
          userId: 'attacker-user',
          total: 0,
          paymentStatus: 'PAID',
          shipping: {
            ...createShipping(),
            userId: 'attacker-user',
            total: 0,
          },
        }),
      ),
    )

    expect(response.status).toBe(201)
    expect(mocks.createCheckoutOrder).toHaveBeenCalledWith(
      'user-1',
      {
        fulfillmentMethod: 'DELIVERY',
        shipping: createShipping(),
      },
      validFingerprint,
    )
    await expect(response.json()).resolves.toEqual({ order })
  })

  test('cria PICKUP sem aceitar morada ou valores enviados pelo browser', async () => {
    const order = createOrder('PICKUP')
    mocks.createCheckoutOrder.mockResolvedValue(order)

    const response = await POST(
      createRequest(
        JSON.stringify({
          ...pickupBody(),
          total: 0,
          paymentStatus: 'PAID',
          shipping: {
            ...createPickupContact(),
            addressLine1: 'Morada inventada',
            city: 'Lisboa',
          },
        }),
      ),
    )

    expect(response.status).toBe(201)
    expect(mocks.createCheckoutOrder).toHaveBeenCalledWith(
      'user-1',
      {
        fulfillmentMethod: 'PICKUP',
        shipping: createPickupContact(),
      },
      validFingerprint,
    )
    await expect(response.json()).resolves.toEqual({ order })
  })

  test('devolve 409 específico quando o preview deixou de corresponder ao checkout', async () => {
    const error = new mocks.CheckoutPreviewChangedError()
    mocks.createCheckoutOrder.mockRejectedValue(error)

    const response = await POST(
      createRequest(JSON.stringify(deliveryBody())),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: error.message,
      code: 'CHECKOUT_PREVIEW_CHANGED',
    })
  })

  test('devolve 400 para erro de validação do checkout', async () => {
    mocks.createCheckoutOrder.mockRejectedValue(
      new mocks.CheckoutValidationError('Dados inválidos'),
    )

    const response = await POST(
      createRequest(JSON.stringify(deliveryBody())),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Dados inválidos',
    })
  })

  test('devolve 403 quando o utilizador desaparece entre autenticação e checkout', async () => {
    mocks.createCheckoutOrder.mockRejectedValue(
      new mocks.CheckoutUserUnavailableError(),
    )

    const response = await POST(
      createRequest(JSON.stringify(deliveryBody())),
    )

    expect(response.status).toBe(403)
  })

  test.each([
    ['carrinho vazio', new mocks.CheckoutEmptyCartError()],
    ['produto indisponível', new mocks.CheckoutProductUnavailableError()],
    ['stock insuficiente', new mocks.CheckoutInsufficientStockError()],
    ['carrinho alterado', new mocks.CheckoutCartChangedError()],
    ['preços inválidos', new mocks.CheckoutPricingError()],
  ])('devolve 409 para %s', async (_label, error) => {
    mocks.createCheckoutOrder.mockRejectedValue(error)

    const response = await POST(
      createRequest(JSON.stringify(deliveryBody())),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: error.message,
    })
  })

  test('devolve 500 genérico para erro inesperado', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    mocks.createCheckoutOrder.mockRejectedValue(
      new Error('Erro inesperado'),
    )

    const response = await POST(
      createRequest(JSON.stringify(deliveryBody())),
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Erro interno do servidor',
    })
    expect(consoleError).toHaveBeenCalledWith(
      'Unexpected checkout API error:',
      expect.any(Error),
    )

    consoleError.mockRestore()
  })
})
