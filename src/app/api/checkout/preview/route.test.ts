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

  return {
    requireActiveUserId: vi.fn(),
    previewCheckout: vi.fn(),
    UnauthorizedUserError,
    CheckoutValidationError,
    CheckoutUserUnavailableError,
    CheckoutEmptyCartError,
    CheckoutProductUnavailableError,
    CheckoutInsufficientStockError,
    CheckoutCartChangedError,
    CheckoutPricingError,
  }
})

vi.mock('@/server/user-auth', () => ({
  requireActiveUserId: mocks.requireActiveUserId,
  UnauthorizedUserError: mocks.UnauthorizedUserError,
}))

vi.mock('@/server/checkout', () => ({
  previewCheckout: mocks.previewCheckout,
  CheckoutValidationError: mocks.CheckoutValidationError,
  CheckoutUserUnavailableError: mocks.CheckoutUserUnavailableError,
  CheckoutEmptyCartError: mocks.CheckoutEmptyCartError,
  CheckoutProductUnavailableError: mocks.CheckoutProductUnavailableError,
  CheckoutInsufficientStockError: mocks.CheckoutInsufficientStockError,
  CheckoutCartChangedError: mocks.CheckoutCartChangedError,
  CheckoutPricingError: mocks.CheckoutPricingError,
}))

import { POST } from './route'

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

function createPreview(
  fulfillmentMethod: 'DELIVERY' | 'PICKUP' = 'DELIVERY',
) {
  return {
    fingerprint: 'ab'.repeat(32),
    subtotal: 100,
    shippingCost: fulfillmentMethod === 'PICKUP' ? 0 : 5.9,
    tax: 19.8,
    total: fulfillmentMethod === 'PICKUP' ? 100 : 105.9,
  }
}

function createRequest(body: string) {
  return new Request(
    'http://localhost/api/checkout/preview',
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
    paymentMethod: 'CARD',
    installmentCount: null,
    ...overrides,
  }
}

function pickupBody(
  overrides: Record<string, unknown> = {},
) {
  return {
    fulfillmentMethod: 'PICKUP',
    shipping: createPickupContact(),
    paymentMethod: 'CARD',
    installmentCount: null,
    ...overrides,
  }
}

describe('/api/checkout/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireActiveUserId.mockResolvedValue('user-1')
    mocks.previewCheckout.mockResolvedValue(createPreview())
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
    expect(mocks.previewCheckout).not.toHaveBeenCalled()
  })

  test('rejeita JSON inválido', async () => {
    const response = await POST(createRequest('{'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'JSON inválido',
      code: 'INVALID_JSON',
    })
    expect(mocks.previewCheckout).not.toHaveBeenCalled()
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
    expect(mocks.previewCheckout).not.toHaveBeenCalled()
  })

  test('rejeita corpo que não é objeto', async () => {
    const response = await POST(
      createRequest(JSON.stringify(null)),
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
    expect(mocks.previewCheckout).not.toHaveBeenCalled()
  })

  test('rejeita DELIVERY sem morada completa', async () => {
    const response = await POST(
      createRequest(
        JSON.stringify(
          deliveryBody({
            shipping: createPickupContact(),
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
              phone: '910000000',
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

  test.each([
    undefined,
    null,
    '',
    'CASH',
  ])('rejeita método de pagamento inválido %j', async (paymentMethod) => {
    const response = await POST(
      createRequest(
        JSON.stringify(
          deliveryBody({ paymentMethod }),
        ),
      ),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Dados de pagamento inválidos',
      code: 'INVALID_PAYMENT',
    })
    expect(mocks.previewCheckout).not.toHaveBeenCalled()
  })

  test.each([
    1,
    2,
    '2',
  ])('rejeita prestações em pagamento CARD %j', async (installmentCount) => {
    const response = await POST(
      createRequest(
        JSON.stringify(
          deliveryBody({ installmentCount }),
        ),
      ),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Dados de pagamento inválidos',
      code: 'INVALID_PAYMENT',
    })
    expect(mocks.previewCheckout).not.toHaveBeenCalled()
  })

  test.each([
    undefined,
    null,
    1,
    2.5,
    '3',
  ])('rejeita número de prestações inválido %j', async (installmentCount) => {
    const response = await POST(
      createRequest(
        JSON.stringify(
          deliveryBody({
            paymentMethod: 'INSTALLMENTS',
            installmentCount,
          }),
        ),
      ),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Dados de pagamento inválidos',
      code: 'INVALID_PAYMENT',
    })
    expect(mocks.previewCheckout).not.toHaveBeenCalled()
  })

  test('devolve preview de prestações sem encaminhar campos de estado ou fornecedor', async () => {
    const preview = createPreview('DELIVERY')
    mocks.previewCheckout.mockResolvedValue(preview)

    const response = await POST(
      createRequest(
        JSON.stringify(
          deliveryBody({
            paymentMethod: 'INSTALLMENTS',
            installmentCount: 4,
            paymentStatus: 'PAID',
            paymentProvider: 'attacker-provider',
            paymentReference: 'attacker-reference',
          }),
        ),
      ),
    )

    expect(response.status).toBe(200)
    expect(mocks.previewCheckout).toHaveBeenCalledWith(
      'user-1',
      {
        fulfillmentMethod: 'DELIVERY',
        shipping: createShipping(),
        paymentMethod: 'INSTALLMENTS',
        installmentCount: 4,
      },
    )
    await expect(response.json()).resolves.toEqual({ preview })
  })

  test('devolve preview DELIVERY e extrai apenas campos autorizados', async () => {
    const preview = createPreview('DELIVERY')
    mocks.previewCheckout.mockResolvedValue(preview)

    const response = await POST(
      createRequest(
        JSON.stringify({
          ...deliveryBody(),
          userId: 'attacker-user',
          total: 0,
          paymentStatus: 'PAID',
          paymentProvider: 'attacker-provider',
          paymentReference: 'attacker-reference',
          shipping: {
            ...createShipping(),
            paymentStatus: 'PAID',
          },
        }),
      ),
    )

    expect(response.status).toBe(200)
    expect(mocks.previewCheckout).toHaveBeenCalledWith(
      'user-1',
      {
        fulfillmentMethod: 'DELIVERY',
        shipping: createShipping(),
        paymentMethod: 'CARD',
        installmentCount: null,
      },
    )
    await expect(response.json()).resolves.toEqual({ preview })
  })

  test('devolve preview PICKUP apenas com nome e telefone', async () => {
    const preview = createPreview('PICKUP')
    mocks.previewCheckout.mockResolvedValue(preview)

    const response = await POST(
      createRequest(
        JSON.stringify({
          ...pickupBody(),
          shipping: {
            ...createPickupContact(),
            addressLine1: 'Ignorar',
            city: 'Ignorar',
          },
        }),
      ),
    )

    expect(response.status).toBe(200)
    expect(mocks.previewCheckout).toHaveBeenCalledWith(
      'user-1',
      {
        fulfillmentMethod: 'PICKUP',
        shipping: createPickupContact(),
        paymentMethod: 'CARD',
        installmentCount: null,
      },
    )
    await expect(response.json()).resolves.toEqual({ preview })
  })

  test('devolve 400 para erro de validação do checkout', async () => {
    mocks.previewCheckout.mockRejectedValue(
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

  test('devolve 403 quando o utilizador desaparece entre autenticação e preview', async () => {
    mocks.previewCheckout.mockRejectedValue(
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
    mocks.previewCheckout.mockRejectedValue(error)

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

    mocks.previewCheckout.mockRejectedValue(
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
      'Unexpected checkout preview API error:',
      expect.any(Error),
    )

    consoleError.mockRestore()
  })
})
