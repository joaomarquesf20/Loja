import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  authOptions: {},
}))

vi.mock('@/server/cart', () => {
  class CartValidationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'CartValidationError'
    }
  }

  class CartProductUnavailableError extends Error {
    constructor(
      message = 'Produto indisponível',
    ) {
      super(message)
      this.name =
        'CartProductUnavailableError'
    }
  }

  class CartInsufficientStockError extends Error {
    constructor(
      message = 'Stock insuficiente',
    ) {
      super(message)
      this.name =
        'CartInsufficientStockError'
    }
  }

  class CartItemNotFoundError extends Error {
    constructor(
      message = 'Item do carrinho não encontrado',
    ) {
      super(message)
      this.name =
        'CartItemNotFoundError'
    }
  }

  return {
    listCartItems: vi.fn(),
    addCartItem: vi.fn(),
    updateCartItemQuantity: vi.fn(),
    removeCartItem: vi.fn(),
    CartValidationError,
    CartProductUnavailableError,
    CartInsufficientStockError,
    CartItemNotFoundError,
  }
})

import { getServerSession } from 'next-auth'
import {
  addCartItem,
  CartInsufficientStockError,
  CartItemNotFoundError,
  CartProductUnavailableError,
  CartValidationError,
  listCartItems,
  removeCartItem,
  updateCartItemQuantity,
} from '@/server/cart'
import {
  DELETE,
  GET,
  PATCH,
  POST,
} from './route'

const mockGetServerSession =
  vi.mocked(getServerSession)

const mockListCartItems =
  vi.mocked(listCartItems)

const mockAddCartItem =
  vi.mocked(addCartItem)

const mockUpdateCartItemQuantity =
  vi.mocked(updateCartItemQuantity)

const mockRemoveCartItem =
  vi.mocked(removeCartItem)

const authenticatedSession = {
  user: {
    id: 'user-1',
    email: 'buyer@example.com',
    name: 'Buyer',
    role: 'BUYER' as const,
  },
  expires:
    '2099-01-01T00:00:00.000Z',
}

const cartItem = {
  id: 'cart-item-1',
  productId: 'product-1',
  quantity: 2,
  product: {
    id: 'product-1',
    name: 'Produto 1',
    slug: 'produto-1',
    price: 19.99,
    images: [],
  },
  inStock: true,
  isAvailable: true,
  canIncrease: true,
}

function createRequest(
  method: string,
  body: string,
) {
  return new Request(
    'http://localhost/api/cart',
    {
      method,
      headers: {
        'Content-Type':
          'application/json',
      },
      body,
    },
  )
}

describe('/api/cart', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetServerSession.mockReset()
    mockListCartItems.mockReset()
    mockAddCartItem.mockReset()
    mockUpdateCartItemQuantity.mockReset()
    mockRemoveCartItem.mockReset()

    mockGetServerSession.mockResolvedValue(
      authenticatedSession,
    )
  })

  describe('GET', () => {
    test('devolve 401 quando utilizador não está autenticado', async () => {
      mockGetServerSession.mockResolvedValue(
        null,
      )

      const response = await GET()

      expect(response.status).toBe(401)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Não autenticado',
      })

      expect(
        mockListCartItems,
      ).not.toHaveBeenCalled()
    })

    test('devolve carrinho do utilizador autenticado', async () => {
      mockListCartItems.mockResolvedValue([
        cartItem,
      ])

      const response = await GET()

      expect(response.status).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual({
        items: [cartItem],
      })

      expect(
        mockListCartItems,
      ).toHaveBeenCalledWith(
        'user-1',
      )
    })

    test('devolve 500 em erro inesperado', async () => {
      const consoleError =
        vi.spyOn(
          console,
          'error',
        ).mockImplementation(() => {})

      mockListCartItems.mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await GET()

      expect(response.status).toBe(500)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Erro interno do servidor',
      })

      expect(
        consoleError,
      ).toHaveBeenCalled()

      consoleError.mockRestore()
    })
  })

  describe('POST', () => {
    test('devolve 401 quando utilizador não está autenticado', async () => {
      mockGetServerSession.mockResolvedValue(
        null,
      )

      const response = await POST(
        createRequest(
          'POST',
          JSON.stringify({
            productId: 'product-1',
          }),
        ),
      )

      expect(response.status).toBe(401)

      expect(
        mockAddCartItem,
      ).not.toHaveBeenCalled()
    })

    test('rejeita JSON inválido', async () => {
      const response = await POST(
        createRequest(
          'POST',
          '{',
        ),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'JSON inválido',
      })
    })

    test('rejeita corpo que não é objeto', async () => {
      const response = await POST(
        createRequest(
          'POST',
          JSON.stringify([]),
        ),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Pedido inválido',
      })
    })

    test('rejeita productId em falta', async () => {
      const response = await POST(
        createRequest(
          'POST',
          JSON.stringify({
            quantity: 1,
          }),
        ),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Produto inválido',
      })
    })

    test('rejeita quantidade com tipo inválido', async () => {
      const response = await POST(
        createRequest(
          'POST',
          JSON.stringify({
            productId: 'product-1',
            quantity: '2',
          }),
        ),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Quantidade inválida',
      })
    })

    test('usa quantidade 1 quando quantity é omitida', async () => {
      mockAddCartItem.mockResolvedValue(
        cartItem,
      )

      const response = await POST(
        createRequest(
          'POST',
          JSON.stringify({
            productId: 'product-1',
          }),
        ),
      )

      expect(response.status).toBe(200)

      expect(
        mockAddCartItem,
      ).toHaveBeenCalledWith(
        'user-1',
        'product-1',
        1,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        item: cartItem,
      })
    })

    test('adiciona quantidade explícita ao carrinho', async () => {
      mockAddCartItem.mockResolvedValue({
        ...cartItem,
        quantity: 3,
      })

      const response = await POST(
        createRequest(
          'POST',
          JSON.stringify({
            productId: 'product-1',
            quantity: 3,
          }),
        ),
      )

      expect(response.status).toBe(200)

      expect(
        mockAddCartItem,
      ).toHaveBeenCalledWith(
        'user-1',
        'product-1',
        3,
      )
    })

    test('devolve 400 para erro de validação', async () => {
      mockAddCartItem.mockRejectedValue(
        new CartValidationError(
          'Quantidade inválida',
        ),
      )

      const response = await POST(
        createRequest(
          'POST',
          JSON.stringify({
            productId: 'product-1',
            quantity: 0,
          }),
        ),
      )

      expect(response.status).toBe(400)
    })

    test('devolve 404 quando produto não está disponível', async () => {
      mockAddCartItem.mockRejectedValue(
        new CartProductUnavailableError(),
      )

      const response = await POST(
        createRequest(
          'POST',
          JSON.stringify({
            productId: 'product-1',
          }),
        ),
      )

      expect(response.status).toBe(404)
    })

    test('devolve 409 quando não existe stock suficiente', async () => {
      mockAddCartItem.mockRejectedValue(
        new CartInsufficientStockError(),
      )

      const response = await POST(
        createRequest(
          'POST',
          JSON.stringify({
            productId: 'product-1',
            quantity: 20,
          }),
        ),
      )

      expect(response.status).toBe(409)
    })

    test('devolve 500 em erro inesperado', async () => {
      const consoleError =
        vi.spyOn(
          console,
          'error',
        ).mockImplementation(() => {})

      mockAddCartItem.mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await POST(
        createRequest(
          'POST',
          JSON.stringify({
            productId: 'product-1',
          }),
        ),
      )

      expect(response.status).toBe(500)

      expect(
        consoleError,
      ).toHaveBeenCalled()

      consoleError.mockRestore()
    })
  })

  describe('PATCH', () => {
    test('devolve 401 quando utilizador não está autenticado', async () => {
      mockGetServerSession.mockResolvedValue(
        null,
      )

      const response = await PATCH(
        createRequest(
          'PATCH',
          JSON.stringify({
            productId: 'product-1',
            quantity: 2,
          }),
        ),
      )

      expect(response.status).toBe(401)

      expect(
        mockUpdateCartItemQuantity,
      ).not.toHaveBeenCalled()
    })

    test('rejeita JSON inválido', async () => {
      const response = await PATCH(
        createRequest(
          'PATCH',
          '{',
        ),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'JSON inválido',
      })
    })

    test('rejeita corpo que não é objeto', async () => {
      const response = await PATCH(
        createRequest(
          'PATCH',
          JSON.stringify([]),
        ),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Pedido inválido',
      })
    })

    test('rejeita productId em falta', async () => {
      const response = await PATCH(
        createRequest(
          'PATCH',
          JSON.stringify({
            quantity: 2,
          }),
        ),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Produto inválido',
      })
    })

    test('rejeita quantidade em falta ou com tipo inválido', async () => {
      const response = await PATCH(
        createRequest(
          'PATCH',
          JSON.stringify({
            productId: 'product-1',
          }),
        ),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Quantidade inválida',
      })

      expect(
        mockUpdateCartItemQuantity,
      ).not.toHaveBeenCalled()
    })

    test('altera a quantidade do item', async () => {
      mockUpdateCartItemQuantity.mockResolvedValue({
        ...cartItem,
        quantity: 4,
      })

      const response = await PATCH(
        createRequest(
          'PATCH',
          JSON.stringify({
            productId: 'product-1',
            quantity: 4,
          }),
        ),
      )

      expect(response.status).toBe(200)

      expect(
        mockUpdateCartItemQuantity,
      ).toHaveBeenCalledWith(
        'user-1',
        'product-1',
        4,
      )

      await expect(
        response.json(),
      ).resolves.toMatchObject({
        item: {
          productId: 'product-1',
          quantity: 4,
        },
      })
    })

    test('devolve 400 para erro de validação', async () => {
      mockUpdateCartItemQuantity.mockRejectedValue(
        new CartValidationError(
          'Quantidade inválida',
        ),
      )

      const response = await PATCH(
        createRequest(
          'PATCH',
          JSON.stringify({
            productId: 'product-1',
            quantity: 0,
          }),
        ),
      )

      expect(response.status).toBe(400)
    })

    test('devolve 404 quando item não existe', async () => {
      mockUpdateCartItemQuantity.mockRejectedValue(
        new CartItemNotFoundError(),
      )

      const response = await PATCH(
        createRequest(
          'PATCH',
          JSON.stringify({
            productId: 'product-1',
            quantity: 2,
          }),
        ),
      )

      expect(response.status).toBe(404)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Item do carrinho não encontrado',
      })
    })

    test('devolve 404 quando produto ficou indisponível', async () => {
      mockUpdateCartItemQuantity.mockRejectedValue(
        new CartProductUnavailableError(),
      )

      const response = await PATCH(
        createRequest(
          'PATCH',
          JSON.stringify({
            productId: 'product-1',
            quantity: 2,
          }),
        ),
      )

      expect(response.status).toBe(404)
    })

    test('devolve 409 quando quantidade excede stock', async () => {
      mockUpdateCartItemQuantity.mockRejectedValue(
        new CartInsufficientStockError(),
      )

      const response = await PATCH(
        createRequest(
          'PATCH',
          JSON.stringify({
            productId: 'product-1',
            quantity: 20,
          }),
        ),
      )

      expect(response.status).toBe(409)
    })

    test('devolve 500 em erro inesperado', async () => {
      const consoleError =
        vi.spyOn(
          console,
          'error',
        ).mockImplementation(() => {})

      mockUpdateCartItemQuantity.mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await PATCH(
        createRequest(
          'PATCH',
          JSON.stringify({
            productId: 'product-1',
            quantity: 2,
          }),
        ),
      )

      expect(response.status).toBe(500)

      expect(
        consoleError,
      ).toHaveBeenCalled()

      consoleError.mockRestore()
    })
  })

  describe('DELETE', () => {
    test('devolve 401 quando utilizador não está autenticado', async () => {
      mockGetServerSession.mockResolvedValue(
        null,
      )

      const response = await DELETE(
        createRequest(
          'DELETE',
          JSON.stringify({
            productId: 'product-1',
          }),
        ),
      )

      expect(response.status).toBe(401)

      expect(
        mockRemoveCartItem,
      ).not.toHaveBeenCalled()
    })

    test('rejeita JSON inválido', async () => {
      const response = await DELETE(
        createRequest(
          'DELETE',
          '{',
        ),
      )

      expect(response.status).toBe(400)
    })

    test('rejeita corpo que não é objeto', async () => {
      const response = await DELETE(
        createRequest(
          'DELETE',
          JSON.stringify([]),
        ),
      )

      expect(response.status).toBe(400)
    })

    test('rejeita productId em falta', async () => {
      const response = await DELETE(
        createRequest(
          'DELETE',
          JSON.stringify({}),
        ),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Produto inválido',
      })
    })

    test('remove item do utilizador autenticado', async () => {
      mockRemoveCartItem.mockResolvedValue(
        undefined,
      )

      const response = await DELETE(
        createRequest(
          'DELETE',
          JSON.stringify({
            productId: 'product-1',
          }),
        ),
      )

      expect(response.status).toBe(204)

      expect(
        mockRemoveCartItem,
      ).toHaveBeenCalledWith(
        'user-1',
        'product-1',
      )

      expect(
        await response.text(),
      ).toBe('')
    })

    test('devolve 400 para erro de validação', async () => {
      mockRemoveCartItem.mockRejectedValue(
        new CartValidationError(
          'Produto inválido',
        ),
      )

      const response = await DELETE(
        createRequest(
          'DELETE',
          JSON.stringify({
            productId: '   ',
          }),
        ),
      )

      expect(response.status).toBe(400)
    })

    test('devolve 404 quando item não existe', async () => {
      mockRemoveCartItem.mockRejectedValue(
        new CartItemNotFoundError(),
      )

      const response = await DELETE(
        createRequest(
          'DELETE',
          JSON.stringify({
            productId: 'product-1',
          }),
        ),
      )

      expect(response.status).toBe(404)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Item do carrinho não encontrado',
      })
    })

    test('devolve 500 em erro inesperado', async () => {
      const consoleError =
        vi.spyOn(
          console,
          'error',
        ).mockImplementation(() => {})

      mockRemoveCartItem.mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await DELETE(
        createRequest(
          'DELETE',
          JSON.stringify({
            productId: 'product-1',
          }),
        ),
      )

      expect(response.status).toBe(500)

      expect(
        consoleError,
      ).toHaveBeenCalled()

      consoleError.mockRestore()
    })
  })
})