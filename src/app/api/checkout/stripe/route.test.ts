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

  class StripeConfigurationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'StripeConfigurationError'
    }
  }

  class StripeSessionRequestError extends Error {
    constructor(message = 'Não foi possível iniciar o pagamento no Stripe') {
      super(message)
      this.name = 'StripeSessionRequestError'
    }
  }

  class StripeCheckoutConflictError extends Error {
    constructor(message = 'A encomenda foi alterada durante a iniciação do pagamento') {
      super(message)
      this.name = 'StripeCheckoutConflictError'
    }
  }

  class StripeCheckoutOrderNotFoundError extends Error {
    constructor() {
      super('Encomenda não encontrada')
      this.name = 'StripeCheckoutOrderNotFoundError'
    }
  }

  class StripeValidationError extends Error {
    constructor(
      public readonly field: string,
      message: string,
    ) {
      super(message)
      this.name = 'StripeValidationError'
    }
  }

  return {
    requireActiveUserId: vi.fn(),
    createCheckoutOrder: vi.fn(),
    initiateStripeCheckoutForOrder: vi.fn(),
    UnauthorizedUserError,
    CheckoutValidationError,
    CheckoutUserUnavailableError,
    CheckoutEmptyCartError,
    CheckoutProductUnavailableError,
    CheckoutInsufficientStockError,
    CheckoutCartChangedError,
    CheckoutPricingError,
    CheckoutPreviewChangedError,
    StripeConfigurationError,
    StripeSessionRequestError,
    StripeCheckoutConflictError,
    StripeCheckoutOrderNotFoundError,
    StripeValidationError,
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

vi.mock('@/server/stripe', () => ({
  STRIPE_PAYMENT_PROVIDER: 'STRIPE',
  STRIPE_CHECKOUT_COMPLETED_EVENT:
    'checkout.session.completed',
  StripeConfigurationError: mocks.StripeConfigurationError,
  StripeSessionRequestError: mocks.StripeSessionRequestError,
  StripeCheckoutConflictError: mocks.StripeCheckoutConflictError,
  StripeCheckoutOrderNotFoundError: mocks.StripeCheckoutOrderNotFoundError,
  StripeValidationError: mocks.StripeValidationError,
  initiateStripeCheckoutForOrder: mocks.initiateStripeCheckoutForOrder,
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

function createOrder() {
  return {
    id: 'order-1',
    orderNumber: 'PFA-ABC123',
    fulfillmentMethod: 'DELIVERY',
    subtotal: 100,
    shippingCost: 5.9,
    tax: 19.8,
    total: 105.9,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    paymentMethod: 'CARD',
    installmentCount: null,
  }
}

function createRequest(
  body: string,
  url = 'http://localhost/api/checkout/stripe',
) {
  return new Request(
    url,
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
    expectedFingerprint: validFingerprint,
    ...overrides,
  }
}

function createSessionResult() {
  return {
    orderId: 'order-1',
    sessionId: 'cs_test_123',
    sessionUrl:
      'https://stripe.test/pagar',
  }
}

describe('/api/checkout/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireActiveUserId.mockResolvedValue(
      'user-1',
    )
    mocks.createCheckoutOrder.mockResolvedValue(
      createOrder(),
    )
    mocks.initiateStripeCheckoutForOrder.mockResolvedValue(
      createSessionResult(),
    )
  })

  test('devolve 401 quando a sessão não corresponde a um utilizador ativo', async () => {
    mocks.requireActiveUserId.mockRejectedValue(
      new mocks.UnauthorizedUserError(),
    )

    const response = await POST(
      createRequest(
        JSON.stringify(deliveryBody()),
      ),
    )

    expect(response.status).toBe(401)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      error: 'Não autenticado',
      code: 'UNAUTHENTICATED',
    })
    expect(
      mocks.createCheckoutOrder,
    ).not.toHaveBeenCalled()
    expect(
      mocks.initiateStripeCheckoutForOrder,
    ).not.toHaveBeenCalled()
  })

  test('devolve 400 para JSON inválido', async () => {
    const response = await POST(
      createRequest('não sou json'),
    )

    expect(response.status).toBe(400)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      code: 'INVALID_JSON',
    })
  })

  test('devolve 400 quando o corpo não é um objeto', async () => {
    const response = await POST(
      createRequest(
        JSON.stringify([1, 2, 3]),
      ),
    )

    expect(response.status).toBe(400)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      code: 'INVALID_REQUEST',
    })
  })

  test('devolve 400 para método de entrega inválido', async () => {
    const response = await POST(
      createRequest(
        JSON.stringify(
          deliveryBody({
            fulfillmentMethod: 'REBOQUE',
          }),
        ),
      ),
    )

    expect(response.status).toBe(400)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      code: 'INVALID_FULFILLMENT_METHOD',
    })
  })

  test('devolve 400 para dados de entrega inválidos', async () => {
    const response = await POST(
      createRequest(
        JSON.stringify(
          deliveryBody({
            shipping: { name: 'Sozinho' },
          }),
        ),
      ),
    )

    expect(response.status).toBe(400)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      code: 'INVALID_SHIPPING',
    })
  })

  test('devolve 400 para pagamento inválido', async () => {
    const response = await POST(
      createRequest(
        JSON.stringify(
          deliveryBody({
            paymentMethod: 'MODALIDADE',
          }),
        ),
      ),
    )

    expect(response.status).toBe(400)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      code: 'INVALID_PAYMENT',
    })
  })

  test('devolve 400 para fingerprint inválido', async () => {
    const response = await POST(
      createRequest(
        JSON.stringify(
          deliveryBody({
            expectedFingerprint: 'curto',
          }),
        ),
      ),
    )

    expect(response.status).toBe(400)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      code: 'INVALID_FINGERPRINT',
    })
  })

  test('devolve 409 quando o stock é insuficiente', async () => {
    mocks.createCheckoutOrder.mockRejectedValue(
      new mocks.CheckoutInsufficientStockError(),
    )

    const response = await POST(
      createRequest(
        JSON.stringify(deliveryBody()),
      ),
    )

    expect(response.status).toBe(409)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      error: 'Existe stock insuficiente para um produto do carrinho',
    })
    expect(
      mocks.initiateStripeCheckoutForOrder,
    ).not.toHaveBeenCalled()
  })

  test('devolve 409 quando o preview mudou', async () => {
    mocks.createCheckoutOrder.mockRejectedValue(
      new mocks.CheckoutPreviewChangedError(),
    )

    const response = await POST(
      createRequest(
        JSON.stringify(deliveryBody()),
      ),
    )

    expect(response.status).toBe(409)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      code: 'CHECKOUT_PREVIEW_CHANGED',
    })
  })

  test('cria a encomenda e devolve a sessão de checkout', async () => {
    const response = await POST(
      createRequest(
        JSON.stringify(deliveryBody()),
      ),
    )

    expect(response.status).toBe(201)

    await expect(
      response.json(),
    ).resolves.toEqual({
      order: createOrder(),
      checkoutSession: {
        id: 'cs_test_123',
        url: 'https://stripe.test/pagar',
      },
    })

    expect(
      mocks.createCheckoutOrder,
    ).toHaveBeenCalledWith(
      'user-1',
      {
        fulfillmentMethod: 'DELIVERY',
        shipping: createShipping(),
        shippingMethod: undefined,
        paymentMethod: 'CARD',
        installmentCount: null,
      },
      validFingerprint,
    )

    expect(
      mocks.initiateStripeCheckoutForOrder,
    ).toHaveBeenCalledTimes(1)

    const [
      orderId,
      userId,
      urls,
    ] =
      mocks.initiateStripeCheckoutForOrder
        .mock.calls[0]

    expect(orderId).toBe('order-1')
    expect(userId).toBe('user-1')

    expect(
      urls.successUrl,
    ).toBe(
      'http://localhost:3000/checkout/sucesso?order=PFA-ABC123&session_id={CHECKOUT_SESSION_ID}',
    )
    expect(
      urls.cancelUrl,
    ).toBe(
      'http://localhost:3000/checkout?pagamento=cancelado',
    )
  })

  test('devolve 502 quando o Stripe falha', async () => {
    mocks.initiateStripeCheckoutForOrder.mockRejectedValue(
      new mocks.StripeSessionRequestError(),
    )

    const response = await POST(
      createRequest(
        JSON.stringify(deliveryBody()),
      ),
    )

    expect(response.status).toBe(502)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      code: 'STRIPE_UNAVAILABLE',
    })
  })

  test('devolve 409 quando a iniciação conflita', async () => {
    mocks.initiateStripeCheckoutForOrder.mockRejectedValue(
      new mocks.StripeCheckoutConflictError(),
    )

    const response = await POST(
      createRequest(
        JSON.stringify(deliveryBody()),
      ),
    )

    expect(response.status).toBe(409)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      code: 'CHECKOUT_CONFLICT',
    })
  })

  test('devolve 404 quando a encomenda desaparece', async () => {
    mocks.initiateStripeCheckoutForOrder.mockRejectedValue(
      new mocks.StripeCheckoutOrderNotFoundError(),
    )

    const response = await POST(
      createRequest(
        JSON.stringify(deliveryBody()),
      ),
    )

    expect(response.status).toBe(404)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      code: 'ORDER_NOT_FOUND',
    })
  })

  test('devolve 500 quando o Stripe não está configurado', async () => {
    mocks.initiateStripeCheckoutForOrder.mockRejectedValue(
      new mocks.StripeConfigurationError(
        'A chave secreta do Stripe não está configurada',
      ),
    )

    const response = await POST(
      createRequest(
        JSON.stringify(deliveryBody()),
      ),
    )

    expect(response.status).toBe(500)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      code: 'STRIPE_NOT_CONFIGURED',
    })
  })

  test('devolve 400 para entrada Stripe inválida', async () => {
    mocks.initiateStripeCheckoutForOrder.mockRejectedValue(
      new mocks.StripeValidationError(
        'items',
        'A encomenda não tem artigos para pagamento',
      ),
    )

    const response = await POST(
      createRequest(
        JSON.stringify(deliveryBody()),
      ),
    )

    expect(response.status).toBe(400)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      code: 'INVALID_REQUEST',
    })
  })

  test('devolve 500 para erros inesperados', async () => {
    mocks.initiateStripeCheckoutForOrder.mockRejectedValue(
      new RangeError('boom'),
    )

    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(
        () => undefined,
      )

    try {
      const response = await POST(
        createRequest(
          JSON.stringify(deliveryBody()),
        ),
      )

      expect(
        response.status,
      ).toBe(500)
      await expect(
        response.json(),
      ).resolves.toMatchObject({
        error: 'Erro interno do servidor',
      })
    } finally {
      consoleError.mockRestore()
    }
  })
})
