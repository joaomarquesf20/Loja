import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(
  () => {
    class CartValidationError
      extends Error {
      constructor(
        message: string,
      ) {
        super(message)
        this.name =
          'CartValidationError'
      }
    }

    class CartProductUnavailableError
      extends Error {
      constructor(
        message =
          'Produto indisponível',
      ) {
        super(message)
        this.name =
          'CartProductUnavailableError'
      }
    }

    class CartInsufficientStockError
      extends Error {
      constructor(
        message =
          'Stock insuficiente',
      ) {
        super(message)
        this.name =
          'CartInsufficientStockError'
      }
    }

    class GuestCartServerValidationError
      extends Error {
      constructor(
        message: string,
      ) {
        super(message)
        this.name =
          'GuestCartServerValidationError'
      }
    }

    class CartMergeUserUnavailableError
      extends Error {
      constructor(
        message =
          'Utilizador indisponível',
      ) {
        super(message)
        this.name =
          'CartMergeUserUnavailableError'
      }
    }

    class CartMergeConflictError
      extends Error {
      constructor(
        message =
          'Identificador de merge já utilizado com dados diferentes',
      ) {
        super(message)
        this.name =
          'CartMergeConflictError'
      }
    }

    class UnauthorizedUserError
      extends Error {
      constructor(
        message =
          'Não autenticado',
      ) {
        super(message)
        this.name =
          'UnauthorizedUserError'
      }
    }

    return {
      requireActiveUserId:
        vi.fn(),
      mergeGuestCartIntoUserCart:
        vi.fn(),
      CartValidationError,
      CartProductUnavailableError,
      CartInsufficientStockError,
      GuestCartServerValidationError,
      CartMergeUserUnavailableError,
      CartMergeConflictError,
      UnauthorizedUserError,
    }
  },
)

vi.mock(
  '@/server/user-auth',
  () => ({
    requireActiveUserId:
      mocks.requireActiveUserId,
    UnauthorizedUserError:
      mocks.UnauthorizedUserError,
  }),
)

vi.mock(
  '@/server/cart',
  () => ({
    CartValidationError:
      mocks.CartValidationError,
    CartProductUnavailableError:
      mocks.CartProductUnavailableError,
    CartInsufficientStockError:
      mocks.CartInsufficientStockError,
  }),
)

vi.mock(
  '@/server/guest-cart',
  () => ({
    GuestCartServerValidationError:
      mocks.GuestCartServerValidationError,
  }),
)

vi.mock(
  '@/server/cart-merge',
  () => ({
    mergeGuestCartIntoUserCart:
      mocks.mergeGuestCartIntoUserCart,
    CartMergeUserUnavailableError:
      mocks.CartMergeUserUnavailableError,
    CartMergeConflictError:
      mocks.CartMergeConflictError,
  }),
)

import { POST } from './route'

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

function oversizedRequest() {
  return createRequest(
    JSON.stringify({
      mergeKey:
        'merge-key-1',
      items: [],
      padding:
        'x'.repeat(
          40 * 1024,
        ),
    }),
  )
}

describe(
  '/api/cart/merge',
  () => {
    beforeEach(() => {
      vi.resetAllMocks()

      mocks.requireActiveUserId
        .mockResolvedValue(
          'user-1',
        )

      mocks
        .mergeGuestCartIntoUserCart
        .mockResolvedValue({
          mergedItemCount: 2,
        })
    })

    test(
      'devolve 401 quando utilizador não está autenticado ou ativo',
      async () => {
        mocks.requireActiveUserId
          .mockRejectedValue(
            new mocks
              .UnauthorizedUserError(),
          )

        const response =
          await POST(
            createRequest(
              JSON.stringify({
                mergeKey:
                  'merge-key-1',
                items: [],
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
          code:
            'UNAUTHENTICATED',
        })

        expect(
          mocks
            .mergeGuestCartIntoUserCart,
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
          error:
            'JSON inválido',
          code:
            'INVALID_JSON',
        })

        expect(
          mocks
            .mergeGuestCartIntoUserCart,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita payload demasiado grande',
      async () => {
        const response =
          await POST(
            oversizedRequest(),
          )

        expect(
          response.status,
        ).toBe(413)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Pedido demasiado grande',
          code:
            'PAYLOAD_TOO_LARGE',
        })

        expect(
          mocks
            .mergeGuestCartIntoUserCart,
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
          error:
            'Pedido inválido',
          code:
            'INVALID_REQUEST',
        })

        expect(
          mocks
            .mergeGuestCartIntoUserCart,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita mergeKey em falta ou com tipo inválido',
      async () => {
        const response =
          await POST(
            createRequest(
              JSON.stringify({
                items: [],
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
            'Identificador de merge inválido',
          code:
            'INVALID_MERGE_KEY',
        })

        expect(
          mocks
            .mergeGuestCartIntoUserCart,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita items em falta ou que não sejam array',
      async () => {
        const response =
          await POST(
            createRequest(
              JSON.stringify({
                mergeKey:
                  'merge-key-1',
                items:
                  'invalid',
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
            'Pedido inválido',
          code:
            'INVALID_REQUEST',
        })

        expect(
          mocks
            .mergeGuestCartIntoUserCart,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita item que não é objeto',
      async () => {
        const response =
          await POST(
            createRequest(
              JSON.stringify({
                mergeKey:
                  'merge-key-1',
                items: [
                  null,
                ],
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
            'Item inválido',
          code:
            'INVALID_ITEM',
        })

        expect(
          mocks
            .mergeGuestCartIntoUserCart,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita productId com tipo inválido',
      async () => {
        const response =
          await POST(
            createRequest(
              JSON.stringify({
                mergeKey:
                  'merge-key-1',
                items: [
                  {
                    productId:
                      123,
                    quantity:
                      1,
                  },
                ],
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
            'Produto inválido',
          code:
            'INVALID_PRODUCT',
        })

        expect(
          mocks
            .mergeGuestCartIntoUserCart,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita quantity com tipo inválido',
      async () => {
        const response =
          await POST(
            createRequest(
              JSON.stringify({
                mergeKey:
                  'merge-key-1',
                items: [
                  {
                    productId:
                      'product-1',
                    quantity:
                      '2',
                  },
                ],
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
            'Quantidade inválida',
          code:
            'INVALID_QUANTITY',
        })

        expect(
          mocks
            .mergeGuestCartIntoUserCart,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'faz merge usando apenas o utilizador autenticado e ativo',
      async () => {
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

        const response =
          await POST(
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

        expect(
          response.status,
        ).toBe(200)

        expect(
          mocks
            .requireActiveUserId,
        ).toHaveBeenCalledTimes(
          1,
        )

        expect(
          mocks
            .mergeGuestCartIntoUserCart,
        ).toHaveBeenCalledTimes(
          1,
        )

        expect(
          mocks
            .mergeGuestCartIntoUserCart,
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
      },
    )

    test(
      'devolve 400 para erro de validação do guest cart',
      async () => {
        mocks
          .mergeGuestCartIntoUserCart
          .mockRejectedValue(
            new mocks
              .GuestCartServerValidationError(
                'Quantidade inválida',
              ),
          )

        const response =
          await POST(
            createRequest(
              JSON.stringify({
                mergeKey:
                  'merge-key-1',
                items: [
                  {
                    productId:
                      'product-1',
                    quantity:
                      0,
                  },
                ],
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
            'Quantidade inválida',
          code:
            'GUEST_CART_VALIDATION',
        })
      },
    )

    test(
      'devolve 400 para erro de validação do carrinho',
      async () => {
        mocks
          .mergeGuestCartIntoUserCart
          .mockRejectedValue(
            new mocks
              .CartValidationError(
                'Identificador de merge inválido',
              ),
          )

        const response =
          await POST(
            createRequest(
              JSON.stringify({
                mergeKey: '',
                items: [
                  {
                    productId:
                      'product-1',
                    quantity:
                      1,
                  },
                ],
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
            'Identificador de merge inválido',
          code:
            'CART_VALIDATION',
        })
      },
    )

    test(
      'devolve 403 quando o serviço deteta utilizador indisponível',
      async () => {
        mocks
          .mergeGuestCartIntoUserCart
          .mockRejectedValue(
            new mocks
              .CartMergeUserUnavailableError(),
          )

        const response =
          await POST(
            createRequest(
              JSON.stringify({
                mergeKey:
                  'merge-key-1',
                items: [
                  {
                    productId:
                      'product-1',
                    quantity:
                      1,
                  },
                ],
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
          code:
            'USER_UNAVAILABLE',
        })
      },
    )

    test(
      'devolve 409 quando a mergeKey já foi usada com dados diferentes',
      async () => {
        mocks
          .mergeGuestCartIntoUserCart
          .mockRejectedValue(
            new mocks
              .CartMergeConflictError(),
          )

        const response =
          await POST(
            createRequest(
              JSON.stringify({
                mergeKey:
                  'merge-key-1',
                items: [
                  {
                    productId:
                      'product-1',
                    quantity:
                      1,
                  },
                ],
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(409)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Identificador de merge já utilizado com dados diferentes',
          code:
            'MERGE_CONFLICT',
        })
      },
    )

    test(
      'devolve 404 quando produto está indisponível',
      async () => {
        mocks
          .mergeGuestCartIntoUserCart
          .mockRejectedValue(
            new mocks
              .CartProductUnavailableError(),
          )

        const response =
          await POST(
            createRequest(
              JSON.stringify({
                mergeKey:
                  'merge-key-1',
                items: [
                  {
                    productId:
                      'product-1',
                    quantity:
                      1,
                  },
                ],
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(404)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Produto indisponível',
          code:
            'PRODUCT_UNAVAILABLE',
        })
      },
    )

    test(
      'devolve 409 quando não existe stock suficiente',
      async () => {
        mocks
          .mergeGuestCartIntoUserCart
          .mockRejectedValue(
            new mocks
              .CartInsufficientStockError(),
          )

        const response =
          await POST(
            createRequest(
              JSON.stringify({
                mergeKey:
                  'merge-key-1',
                items: [
                  {
                    productId:
                      'product-1',
                    quantity:
                      20,
                  },
                ],
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(409)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Stock insuficiente',
          code:
            'INSUFFICIENT_STOCK',
        })
      },
    )

    test(
      'devolve 500 em erro inesperado',
      async () => {
        const consoleError =
          vi.spyOn(
            console,
            'error',
          ).mockImplementation(
            () => {},
          )

        mocks
          .mergeGuestCartIntoUserCart
          .mockRejectedValue(
            new Error(
              'Erro inesperado',
            ),
          )

        const response =
          await POST(
            createRequest(
              JSON.stringify({
                mergeKey:
                  'merge-key-1',
                items: [
                  {
                    productId:
                      'product-1',
                    quantity:
                      1,
                  },
                ],
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
          code:
            'INTERNAL_ERROR',
        })

        expect(
          consoleError,
        ).toHaveBeenCalledWith(
          'Unexpected cart merge API error:',
          expect.any(Error),
        )

        consoleError.mockRestore()
      },
    )
  },
)