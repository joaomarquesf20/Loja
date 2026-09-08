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

  return {
    listCartItems: vi.fn(),
    addCartItem: vi.fn(),
    CartValidationError,
    CartProductUnavailableError,
    CartInsufficientStockError,
  }
})

import { getServerSession } from 'next-auth'
import {
  addCartItem,
  CartInsufficientStockError,
  CartProductUnavailableError,
  CartValidationError,
  listCartItems,
} from '@/server/cart'
import {
  GET,
  POST,
} from './route'

const mockGetServerSession =
  vi.mocked(getServerSession)

const mockListCartItems =
  vi.mocked(listCartItems)

const mockAddCartItem =
  vi.mocked(addCartItem)

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

function createPostRequest(
  body: string,
) {
  return new Request(
    'http://localhost/api/cart',
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

describe('/api/cart', () => {
  beforeEach(() => {
    vi.clearAllMocks()

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
        createPostRequest(
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
        createPostRequest('{'),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'JSON inválido',
      })

      expect(
        mockAddCartItem,
      ).not.toHaveBeenCalled()
    })

    test('rejeita corpo que não é objeto', async () => {
      const response = await POST(
        createPostRequest(
          JSON.stringify([]),
        ),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Pedido inválido',
      })

      expect(
        mockAddCartItem,
      ).not.toHaveBeenCalled()
    })

    test('rejeita productId em falta', async () => {
      const response = await POST(
        createPostRequest(
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

      expect(
        mockAddCartItem,
      ).not.toHaveBeenCalled()
    })

    test('rejeita quantidade com tipo inválido', async () => {
      const response = await POST(
        createPostRequest(
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

      expect(
        mockAddCartItem,
      ).not.toHaveBeenCalled()
    })

    test('usa quantidade 1 quando quantity é omitida', async () => {
      mockAddCartItem.mockResolvedValue(
        cartItem,
      )

      const response = await POST(
        createPostRequest(
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
        createPostRequest(
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

      await expect(
        response.json(),
      ).resolves.toMatchObject({
        item: {
          productId: 'product-1',
          quantity: 3,
        },
      })
    })

    test('devolve 400 para erro de validação do carrinho', async () => {
      mockAddCartItem.mockRejectedValue(
        new CartValidationError(
          'Quantidade inválida',
        ),
      )

      const response = await POST(
        createPostRequest(
          JSON.stringify({
            productId: 'product-1',
            quantity: 0,
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

    test('devolve 404 quando produto não está disponível', async () => {
      mockAddCartItem.mockRejectedValue(
        new CartProductUnavailableError(),
      )

      const response = await POST(
        createPostRequest(
          JSON.stringify({
            productId:
              'produto-inexistente',
          }),
        ),
      )

      expect(response.status).toBe(404)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Produto indisponível',
      })
    })

    test('devolve 409 quando não existe stock suficiente', async () => {
      mockAddCartItem.mockRejectedValue(
        new CartInsufficientStockError(),
      )

      const response = await POST(
        createPostRequest(
          JSON.stringify({
            productId: 'product-1',
            quantity: 20,
          }),
        ),
      )

      expect(response.status).toBe(409)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Stock insuficiente',
      })
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
        createPostRequest(
          JSON.stringify({
            productId: 'product-1',
          }),
        ),
      )

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
})