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
    retryStripeCheckoutForOrder: vi.fn(),
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
  StripeConfigurationError: mocks.StripeConfigurationError,
  StripeSessionRequestError: mocks.StripeSessionRequestError,
  StripeCheckoutConflictError: mocks.StripeCheckoutConflictError,
  StripeCheckoutOrderNotFoundError: mocks.StripeCheckoutOrderNotFoundError,
  StripeValidationError: mocks.StripeValidationError,
  retryStripeCheckoutForOrder: mocks.retryStripeCheckoutForOrder,
}))

import { POST } from './route'

function createRequest(
  body: string,
  url = 'http://localhost/api/checkout/stripe/retry',
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

function createRetryResult() {
  return {
    orderId: 'order-1',
    orderNumber: 'PFA-ABC123',
    sessionId: 'cs_test_123',
    sessionUrl:
      'https://stripe.test/pagar',
  }
}

describe('/api/checkout/stripe/retry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireActiveUserId.mockResolvedValue(
      'user-1',
    )
    mocks.retryStripeCheckoutForOrder.mockResolvedValue(
      createRetryResult(),
    )
  })

  test('devolve 401 quando a sessão não corresponde a um utilizador ativo', async () => {
    mocks.requireActiveUserId.mockRejectedValue(
      new mocks.UnauthorizedUserError(),
    )

    const response = await POST(
      createRequest(
        JSON.stringify({ orderId: 'order-1' }),
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
      mocks.retryStripeCheckoutForOrder,
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
    // A validação do orderId recebido é feita pelo serviço; o mock
    // reproduz esse comportamento para o pedido sem objeto atingir o
    // mesmo mapeamento (400 INVALID_REQUEST).
    mocks.retryStripeCheckoutForOrder.mockImplementation(
      (orderId: unknown) =>
        typeof orderId === 'string' &&
        orderId.trim() !== ''
          ? Promise.resolve(
              createRetryResult(),
            )
          : Promise.reject(
              new mocks.StripeValidationError(
                'orderId',
                'Encomenda inválida',
              ),
            ),
    )

    const response = await POST(
      createRequest(
        JSON.stringify([1, 2, 3]),
      ),
    )

    expect(response.status).toBe(400)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      error: 'Encomenda inválida',
      code: 'INVALID_REQUEST',
    })
    expect(
      mocks.retryStripeCheckoutForOrder,
    ).toHaveBeenCalledWith(
      undefined,
      'user-1',
      expect.objectContaining({
        buildSuccessUrl:
          expect.any(Function),
      }),
    )
  })

  test('devolve 400 quando o orderId não é uma string válida', async () => {
    mocks.retryStripeCheckoutForOrder.mockRejectedValue(
      new mocks.StripeValidationError(
        'orderId',
        'Encomenda inválida',
      ),
    )

    const response = await POST(
      createRequest(
        JSON.stringify({ orderId: 42 }),
      ),
    )

    expect(response.status).toBe(400)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      error: 'Encomenda inválida',
      code: 'INVALID_REQUEST',
    })
    expect(
      mocks.retryStripeCheckoutForOrder,
    ).toHaveBeenCalledWith(
      42,
      'user-1',
      expect.objectContaining({
        buildSuccessUrl:
          expect.any(Function),
        cancelUrl:
          'http://localhost:3000/checkout/cancelado',
      }),
    )
  })

  test('devolve 404 quando a encomenda não é do utilizador', async () => {
    mocks.retryStripeCheckoutForOrder.mockRejectedValue(
      new mocks.StripeCheckoutOrderNotFoundError(),
    )

    const response = await POST(
      createRequest(
        JSON.stringify({ orderId: 'order-alheia' }),
      ),
    )

    expect(response.status).toBe(404)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      error: 'Encomenda não encontrada',
      code: 'ORDER_NOT_FOUND',
    })
  })

  test('devolve 409 quando o estado não permite a retoma', async () => {
    mocks.retryStripeCheckoutForOrder.mockRejectedValue(
      new mocks.StripeCheckoutConflictError(
        'O pagamento desta encomenda foi iniciado por outro fornecedor',
      ),
    )

    const response = await POST(
      createRequest(
        JSON.stringify({ orderId: 'order-1' }),
      ),
    )

    expect(response.status).toBe(409)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      error: 'O pagamento desta encomenda foi iniciado por outro fornecedor',
      code: 'CHECKOUT_CONFLICT',
    })
  })

  test('retoma o pagamento e devolve o URL da nova sessão', async () => {
    const response = await POST(
      createRequest(
        JSON.stringify({ orderId: 'order-1' }),
      ),
    )

    expect(response.status).toBe(201)

    await expect(
      response.json(),
    ).resolves.toEqual({
      orderNumber: 'PFA-ABC123',
      checkoutSession: {
        id: 'cs_test_123',
        url: 'https://stripe.test/pagar',
      },
    })

    expect(
      mocks.retryStripeCheckoutForOrder,
    ).toHaveBeenCalledTimes(1)

    const [
      orderId,
      userId,
      urls,
    ] =
      mocks.retryStripeCheckoutForOrder
        .mock.calls[0]

    expect(orderId).toBe('order-1')
    expect(userId).toBe('user-1')

    expect(
      typeof urls.buildSuccessUrl,
    ).toBe('function')

    expect(
      urls.buildSuccessUrl('PFA-ABC123'),
    ).toBe(
      'http://localhost:3000/checkout/sucesso?order=PFA-ABC123&session_id={CHECKOUT_SESSION_ID}',
    )
    expect(
      urls.cancelUrl,
    ).toBe(
      'http://localhost:3000/checkout/cancelado',
    )
  })

  test('constrói os URLs a partir de NEXTAUTH_URL', async () => {
    vi.stubEnv(
      'NEXTAUTH_URL',
      'https://loja.pt/',
    )

    try {
      const response = await POST(
        createRequest(
          JSON.stringify({ orderId: 'order-1' }),
        ),
      )

      expect(response.status).toBe(201)

      // Os URLs são construídos pela rota durante o pedido: a avaliação
      // tem de acontecer com o ambiente ainda substituído.
      const [, , urls] =
        mocks.retryStripeCheckoutForOrder
          .mock.calls[0]

      expect(
        urls.buildSuccessUrl('PFA-ABC123'),
      ).toBe(
        'https://loja.pt/checkout/sucesso?order=PFA-ABC123&session_id={CHECKOUT_SESSION_ID}',
      )
      expect(
        urls.cancelUrl,
      ).toBe(
        'https://loja.pt/checkout/cancelado',
      )
    } finally {
      vi.unstubAllEnvs()
    }
  })

  test('devolve 502 quando o Stripe falha', async () => {
    mocks.retryStripeCheckoutForOrder.mockRejectedValue(
      new mocks.StripeSessionRequestError(),
    )

    const response = await POST(
      createRequest(
        JSON.stringify({ orderId: 'order-1' }),
      ),
    )

    expect(response.status).toBe(502)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      error: 'Não foi possível iniciar o pagamento no Stripe',
      code: 'STRIPE_UNAVAILABLE',
    })
  })

  test('devolve 500 quando o Stripe não está configurado', async () => {
    mocks.retryStripeCheckoutForOrder.mockRejectedValue(
      new mocks.StripeConfigurationError(
        'A chave secreta do Stripe não está configurada',
      ),
    )

    const response = await POST(
      createRequest(
        JSON.stringify({ orderId: 'order-1' }),
      ),
    )

    expect(response.status).toBe(500)
    await expect(
      response.json(),
    ).resolves.toMatchObject({
      error: 'Pagamento por Stripe indisponível nesta loja',
      code: 'STRIPE_NOT_CONFIGURED',
    })
  })

  test('devolve 400 para entrada Stripe inválida', async () => {
    mocks.retryStripeCheckoutForOrder.mockRejectedValue(
      new mocks.StripeValidationError(
        'urls',
        'URLs de retorno do pagamento inválidos',
      ),
    )

    const response = await POST(
      createRequest(
        JSON.stringify({ orderId: 'order-1' }),
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
    mocks.retryStripeCheckoutForOrder.mockRejectedValue(
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
          JSON.stringify({ orderId: 'order-1' }),
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
