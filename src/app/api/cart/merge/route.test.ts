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
      this.name =
        'CartValidationError'
    }
  }

  class CartProductUnavailableError extends Error {
    constructor(
      message =
        'Produto indisponível',
    ) {
      super(message)
      this.name =
        'CartProductUnavailableError'
    }
  }

  class CartInsufficientStockError extends Error {
    constructor(
      message =
        'Stock insuficiente',
    ) {
      super(message)
      this.name =
        'CartInsufficientStockError'
    }
  }

  return {
    CartValidationError,
    CartProductUnavailableError,
    CartInsufficientStockError,
  }
})

vi.mock('@/server/guest-cart', () => {
  class GuestCartServerValidationError extends Error {
    constructor(message: string) {
      super(message)
      this.name =
        'GuestCartServerValidationError'
    }
  }

  return {
    GuestCartServerValidationError,
  }
})

vi.mock('@/server/cart-merge', () => {
  class CartMergeUserUnavailableError extends Error {
    constructor(
      message =
        'Utilizador indisponível',
    ) {
      super(message)
      this.name =
        'CartMergeUserUnavailableError'
    }
  }

  class CartMergeConflictError extends Error {
    constructor(
      message =
        'Identificador de merge já utilizado com dados diferentes',
    ) {
      super(message)
      this.name =
        'CartMergeConflictError'
    }
  }

  return {
    mergeGuestCartIntoUserCart:
      vi.fn(),
    CartMergeUserUnavailableError,
    CartMergeConflictError,
  }
})

import { getServerSession } from 'next-auth'
import {
  CartInsufficientStockError,
  CartProductUnavailableError,
  CartValidationError,
} from '@/server/cart'
import {
  CartMergeConflictError,
  CartMergeUserUnavailableError,
  mergeGuestCartIntoUserCart,
} from '@/server/cart-merge'
import {
  GuestCartServerValidationError,
} from '@/server/guest-cart'
import { POST } from './route'

const mockGetServerSession =
  vi.mocked(getServerSession)

const mockMergeGuestCart =
  vi.mocked(
    mergeGuestCartIntoUserCart,
  )

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

function createRequest(
  body: string,
) {
  return new Request(
    'http://localhost/api/cart/merge',
    {
      method: 'POST',
      headers: {
        'content-type':
          'application/json',
      },
      body,
    },
  )
}

describe(
  '/api/cart/merge',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mockGetServerSession.mockResolvedValue(
        authenticatedSession,
      )

      mockMergeGuestCart.mockResolvedValue(
        {
          mergedItemCount: 2,
        },
      )
    })

    test('devolve 401 quando utilizador não está autenticado', async () => {
      mockGetServerSession.mockResolvedValue(
        null,
      )

      const response = await POST(
        createRequest(
          JSON.stringify({
            mergeKey:
              'merge-key-1',
            items: [],
          }),
        ),
      )

      expect(response.status).toBe(
        401,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Não autenticado',
      })

      expect(
        mockMergeGuestCart,
      ).not.toHaveBeenCalled()
    })

    test('rejeita JSON inválido', async () => {
      const response = await POST(
        createRequest('{'),
      )

      expect(response.status).toBe(
        400,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'JSON inválido',
      })

      expect(
        mockMergeGuestCart,
      ).not.toHaveBeenCalled()
    })

    test('rejeita corpo que não é objeto', async () => {
      const response = await POST(
        createRequest(
          JSON.stringify([]),
        ),
      )

      expect(response.status).toBe(
        400,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Pedido inválido',
      })

      expect(
        mockMergeGuestCart,
      ).not.toHaveBeenCalled()
    })

    test('rejeita mergeKey em falta ou com tipo inválido', async () => {
      const response = await POST(
        createRequest(
          JSON.stringify({
            items: [],
          }),
        ),
      )

      expect(response.status).toBe(
        400,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Identificador de merge inválido',
      })

      expect(
        mockMergeGuestCart,
      ).not.toHaveBeenCalled()
    })

    test('rejeita items em falta ou que não sejam array', async () => {
      const response = await POST(
        createRequest(
          JSON.stringify({
            mergeKey:
              'merge-key-1',
            items: 'invalid',
          }),
        ),
      )

      expect(response.status).toBe(
        400,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Pedido inválido',
      })

      expect(
        mockMergeGuestCart,
      ).not.toHaveBeenCalled()
    })

    test('rejeita item que não é objeto', async () => {
      const response = await POST(
        createRequest(
          JSON.stringify({
            mergeKey:
              'merge-key-1',
            items: [null],
          }),
        ),
      )

      expect(response.status).toBe(
        400,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Item inválido',
      })

      expect(
        mockMergeGuestCart,
      ).not.toHaveBeenCalled()
    })

    test('rejeita productId com tipo inválido', async () => {
      const response = await POST(
        createRequest(
          JSON.stringify({
            mergeKey:
              'merge-key-1',
            items: [
              {
                productId: 123,
                quantity: 1,
              },
            ],
          }),
        ),
      )

      expect(response.status).toBe(
        400,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Produto inválido',
      })

      expect(
        mockMergeGuestCart,
      ).not.toHaveBeenCalled()
    })

    test('rejeita quantity com tipo inválido', async () => {
      const response = await POST(
        createRequest(
          JSON.stringify({
            mergeKey:
              'merge-key-1',
            items: [
              {
                productId:
                  'product-1',
                quantity: '2',
              },
            ],
          }),
        ),
      )

      expect(response.status).toBe(
        400,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Quantidade inválida',
      })

      expect(
        mockMergeGuestCart,
      ).not.toHaveBeenCalled()
    })

    test('faz merge usando apenas o utilizador autenticado da sessão', async () => {
      const items = [
        {
          productId:
            'product-1',
          quantity: 2,
        },
        {
          productId:
            'product-2',
          quantity: 1,
        },
      ]

      const response = await POST(
        createRequest(
          JSON.stringify({
            mergeKey:
              'merge-key-1',
            items,
            userId:
              'attacker-user-id',
          }),
        ),
      )

      expect(response.status).toBe(
        200,
      )

      expect(
        mockMergeGuestCart,
      ).toHaveBeenCalledTimes(1)

      expect(
        mockMergeGuestCart,
      ).toHaveBeenCalledWith(
        'user-1',
        'merge-key-1',
        items,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        mergedItemCount: 2,
      })
    })

    test('devolve 400 para erro de validação do guest cart', async () => {
      mockMergeGuestCart.mockRejectedValue(
        new GuestCartServerValidationError(
          'Quantidade inválida',
        ),
      )

      const response = await POST(
        createRequest(
          JSON.stringify({
            mergeKey:
              'merge-key-1',
            items: [
              {
                productId:
                  'product-1',
                quantity: 0,
              },
            ],
          }),
        ),
      )

      expect(response.status).toBe(
        400,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Quantidade inválida',
      })
    })

    test('devolve 400 para erro de validação do carrinho', async () => {
      mockMergeGuestCart.mockRejectedValue(
        new CartValidationError(
          'Identificador de merge inválido',
        ),
      )

      const response = await POST(
        createRequest(
          JSON.stringify({
            mergeKey: '',
            items: [
              {
                productId:
                  'product-1',
                quantity: 1,
              },
            ],
          }),
        ),
      )

      expect(response.status).toBe(
        400,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Identificador de merge inválido',
      })
    })

    test('devolve 403 quando utilizador autenticado ficou indisponível', async () => {
      mockMergeGuestCart.mockRejectedValue(
        new CartMergeUserUnavailableError(),
      )

      const response = await POST(
        createRequest(
          JSON.stringify({
            mergeKey:
              'merge-key-1',
            items: [
              {
                productId:
                  'product-1',
                quantity: 1,
              },
            ],
          }),
        ),
      )

      expect(response.status).toBe(
        403,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Utilizador indisponível',
      })
    })

    test('devolve 409 quando a mergeKey já foi usada com dados diferentes', async () => {
      mockMergeGuestCart.mockRejectedValue(
        new CartMergeConflictError(),
      )

      const response = await POST(
        createRequest(
          JSON.stringify({
            mergeKey:
              'merge-key-1',
            items: [
              {
                productId:
                  'product-1',
                quantity: 1,
              },
            ],
          }),
        ),
      )

      expect(response.status).toBe(
        409,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Identificador de merge já utilizado com dados diferentes',
      })
    })

    test('devolve 404 quando produto está indisponível', async () => {
      mockMergeGuestCart.mockRejectedValue(
        new CartProductUnavailableError(),
      )

      const response = await POST(
        createRequest(
          JSON.stringify({
            mergeKey:
              'merge-key-1',
            items: [
              {
                productId:
                  'product-1',
                quantity: 1,
              },
            ],
          }),
        ),
      )

      expect(response.status).toBe(
        404,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Produto indisponível',
      })
    })

    test('devolve 409 quando não existe stock suficiente', async () => {
      mockMergeGuestCart.mockRejectedValue(
        new CartInsufficientStockError(),
      )

      const response = await POST(
        createRequest(
          JSON.stringify({
            mergeKey:
              'merge-key-1',
            items: [
              {
                productId:
                  'product-1',
                quantity: 20,
              },
            ],
          }),
        ),
      )

      expect(response.status).toBe(
        409,
      )

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Stock insuficiente',
      })
    })

    test('devolve 500 em erro inesperado', async () => {
      const consoleError =
        vi.spyOn(
          console,
          'error',
        ).mockImplementation(() => {})

      mockMergeGuestCart.mockRejectedValue(
        new Error(
          'Erro inesperado',
        ),
      )

      const response = await POST(
        createRequest(
          JSON.stringify({
            mergeKey:
              'merge-key-1',
            items: [
              {
                productId:
                  'product-1',
                quantity: 1,
              },
            ],
          }),
        ),
      )

      expect(response.status).toBe(
        500,
      )

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
  },
)
