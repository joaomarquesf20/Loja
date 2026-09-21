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

    class CartItemNotFoundError
      extends Error {
      constructor(
        message =
          'Item do carrinho não encontrado',
      ) {
        super(message)
        this.name =
          'CartItemNotFoundError'
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
      listCartItems:
        vi.fn(),
      addCartItem:
        vi.fn(),
      updateCartItemQuantity:
        vi.fn(),
      removeCartItem:
        vi.fn(),
      CartValidationError,
      CartProductUnavailableError,
      CartInsufficientStockError,
      CartItemNotFoundError,
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
    listCartItems:
      mocks.listCartItems,
    addCartItem:
      mocks.addCartItem,
    updateCartItemQuantity:
      mocks.updateCartItemQuantity,
    removeCartItem:
      mocks.removeCartItem,
    CartValidationError:
      mocks.CartValidationError,
    CartProductUnavailableError:
      mocks.CartProductUnavailableError,
    CartInsufficientStockError:
      mocks.CartInsufficientStockError,
    CartItemNotFoundError:
      mocks.CartItemNotFoundError,
  }),
)

import {
  DELETE,
  GET,
  PATCH,
  POST,
} from './route'

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

function oversizedRequest(
  method: string,
) {
  return createRequest(
    method,
    JSON.stringify({
      padding:
        'x'.repeat(
          70 * 1024,
        ),
    }),
  )
}

type CartHandler = (
  request: Request,
) => Promise<Response>

async function expectPayloadTooLarge(
  method: string,
  handler: CartHandler,
) {
  const response =
    await handler(
      oversizedRequest(method),
    )

  expect(
    response.status,
  ).toBe(413)

  await expect(
    response.json(),
  ).resolves.toEqual({
    error:
      'Pedido demasiado grande',
  })

  expect(
    mocks.addCartItem,
  ).not.toHaveBeenCalled()

  expect(
    mocks.updateCartItemQuantity,
  ).not.toHaveBeenCalled()

  expect(
    mocks.removeCartItem,
  ).not.toHaveBeenCalled()
}

describe('/api/cart', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    mocks.requireActiveUserId
      .mockResolvedValue(
        'user-1',
      )
  })

  describe('GET', () => {
    test(
      'devolve 401 quando utilizador não está autenticado ou ativo',
      async () => {
        mocks.requireActiveUserId
          .mockRejectedValue(
            new mocks
              .UnauthorizedUserError(),
          )

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
          mocks.listCartItems,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve carrinho do utilizador autenticado e ativo',
      async () => {
        mocks.listCartItems
          .mockResolvedValue([
            cartItem,
          ])

        const response =
          await GET()

        expect(
          response.status,
        ).toBe(200)

        await expect(
          response.json(),
        ).resolves.toEqual({
          items: [
            cartItem,
          ],
        })

        expect(
          mocks.listCartItems,
        ).toHaveBeenCalledWith(
          'user-1',
        )
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

        mocks.listCartItems
          .mockRejectedValue(
            new Error(
              'Erro inesperado',
            ),
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

        expect(
          consoleError,
        ).toHaveBeenCalledWith(
          'Unexpected cart API error:',
          expect.any(Error),
        )

        consoleError.mockRestore()
      },
    )
  })

  describe('POST', () => {
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
              'POST',
              JSON.stringify({
                productId:
                  'product-1',
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(401)

        expect(
          mocks.addCartItem,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita JSON inválido',
      async () => {
        const response =
          await POST(
            createRequest(
              'POST',
              '{',
            ),
          )

        expect(
          response.status,
        ).toBe(400)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'JSON inválido',
        })
      },
    )

    test(
      'rejeita payload demasiado grande',
      async () => {
        await expectPayloadTooLarge(
          'POST',
          POST,
        )
      },
    )

    test(
      'rejeita corpo que não é objeto',
      async () => {
        const response =
          await POST(
            createRequest(
              'POST',
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
        })
      },
    )

    test(
      'rejeita produto e variante em falta',
      async () => {
        const response =
          await POST(
            createRequest(
              'POST',
              JSON.stringify({
                quantity: 1,
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
            'Produto ou variante inválido',
        })
      },
    )

    test(
      'rejeita quantidade com tipo inválido',
      async () => {
        const response =
          await POST(
            createRequest(
              'POST',
              JSON.stringify({
                productId:
                  'product-1',
                quantity:
                  '2',
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
        })
      },
    )

    test(
      'usa quantidade 1 quando quantity é omitida',
      async () => {
        mocks.addCartItem
          .mockResolvedValue(
            cartItem,
          )

        const response =
          await POST(
            createRequest(
              'POST',
              JSON.stringify({
                productId:
                  'product-1',
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          mocks.addCartItem,
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
      },
    )

    test(
      'adiciona quantidade explícita ao carrinho',
      async () => {
        mocks.addCartItem
          .mockResolvedValue({
            ...cartItem,
            quantity: 3,
          })

        const response =
          await POST(
            createRequest(
              'POST',
              JSON.stringify({
                productId:
                  'product-1',
                quantity: 3,
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          mocks.addCartItem,
        ).toHaveBeenCalledWith(
          'user-1',
          'product-1',
          3,
        )
      },
    )

    test(
      'devolve 400 para erro de validação',
      async () => {
        mocks.addCartItem
          .mockRejectedValue(
            new mocks
              .CartValidationError(
                'Quantidade inválida',
              ),
          )

        const response =
          await POST(
            createRequest(
              'POST',
              JSON.stringify({
                productId:
                  'product-1',
                quantity: 0,
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(400)
      },
    )

    test(
      'devolve 404 quando produto não está disponível',
      async () => {
        mocks.addCartItem
          .mockRejectedValue(
            new mocks
              .CartProductUnavailableError(),
          )

        const response =
          await POST(
            createRequest(
              'POST',
              JSON.stringify({
                productId:
                  'product-1',
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(404)
      },
    )

    test(
      'devolve 409 quando não existe stock suficiente',
      async () => {
        mocks.addCartItem
          .mockRejectedValue(
            new mocks
              .CartInsufficientStockError(),
          )

        const response =
          await POST(
            createRequest(
              'POST',
              JSON.stringify({
                productId:
                  'product-1',
                quantity: 20,
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(409)
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

        mocks.addCartItem
          .mockRejectedValue(
            new Error(
              'Erro inesperado',
            ),
          )

        const response =
          await POST(
            createRequest(
              'POST',
              JSON.stringify({
                productId:
                  'product-1',
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(500)

        expect(
          consoleError,
        ).toHaveBeenCalledWith(
          'Unexpected cart API error:',
          expect.any(Error),
        )

        consoleError.mockRestore()
      },
    )
  })

  describe('PATCH', () => {
    test(
      'devolve 401 quando utilizador não está autenticado ou ativo',
      async () => {
        mocks.requireActiveUserId
          .mockRejectedValue(
            new mocks
              .UnauthorizedUserError(),
          )

        const response =
          await PATCH(
            createRequest(
              'PATCH',
              JSON.stringify({
                productId:
                  'product-1',
                quantity: 2,
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(401)

        expect(
          mocks
            .updateCartItemQuantity,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita JSON inválido',
      async () => {
        const response =
          await PATCH(
            createRequest(
              'PATCH',
              '{',
            ),
          )

        expect(
          response.status,
        ).toBe(400)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'JSON inválido',
        })
      },
    )

    test(
      'rejeita payload demasiado grande',
      async () => {
        await expectPayloadTooLarge(
          'PATCH',
          PATCH,
        )
      },
    )

    test(
      'rejeita corpo que não é objeto',
      async () => {
        const response =
          await PATCH(
            createRequest(
              'PATCH',
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
        })
      },
    )

    test(
      'rejeita produto e variante em falta',
      async () => {
        const response =
          await PATCH(
            createRequest(
              'PATCH',
              JSON.stringify({
                quantity: 2,
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
            'Produto ou variante inválido',
        })
      },
    )

    test(
      'rejeita quantidade em falta ou com tipo inválido',
      async () => {
        const response =
          await PATCH(
            createRequest(
              'PATCH',
              JSON.stringify({
                productId:
                  'product-1',
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
        })

        expect(
          mocks
            .updateCartItemQuantity,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'altera a quantidade do item',
      async () => {
        mocks
          .updateCartItemQuantity
          .mockResolvedValue({
            ...cartItem,
            quantity: 4,
          })

        const response =
          await PATCH(
            createRequest(
              'PATCH',
              JSON.stringify({
                productId:
                  'product-1',
                quantity: 4,
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          mocks
            .updateCartItemQuantity,
        ).toHaveBeenCalledWith(
          'user-1',
          'product-1',
          4,
        )

        await expect(
          response.json(),
        ).resolves.toMatchObject({
          item: {
            productId:
              'product-1',
            quantity: 4,
          },
        })
      },
    )

    test(
      'devolve 400 para erro de validação',
      async () => {
        mocks
          .updateCartItemQuantity
          .mockRejectedValue(
            new mocks
              .CartValidationError(
                'Quantidade inválida',
              ),
          )

        const response =
          await PATCH(
            createRequest(
              'PATCH',
              JSON.stringify({
                productId:
                  'product-1',
                quantity: 0,
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(400)
      },
    )

    test(
      'devolve 404 quando item não existe',
      async () => {
        mocks
          .updateCartItemQuantity
          .mockRejectedValue(
            new mocks
              .CartItemNotFoundError(),
          )

        const response =
          await PATCH(
            createRequest(
              'PATCH',
              JSON.stringify({
                productId:
                  'product-1',
                quantity: 2,
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
            'Item do carrinho não encontrado',
        })
      },
    )

    test(
      'devolve 404 quando produto ficou indisponível',
      async () => {
        mocks
          .updateCartItemQuantity
          .mockRejectedValue(
            new mocks
              .CartProductUnavailableError(),
          )

        const response =
          await PATCH(
            createRequest(
              'PATCH',
              JSON.stringify({
                productId:
                  'product-1',
                quantity: 2,
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(404)
      },
    )

    test(
      'devolve 409 quando quantidade excede stock',
      async () => {
        mocks
          .updateCartItemQuantity
          .mockRejectedValue(
            new mocks
              .CartInsufficientStockError(),
          )

        const response =
          await PATCH(
            createRequest(
              'PATCH',
              JSON.stringify({
                productId:
                  'product-1',
                quantity: 20,
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(409)
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
          .updateCartItemQuantity
          .mockRejectedValue(
            new Error(
              'Erro inesperado',
            ),
          )

        const response =
          await PATCH(
            createRequest(
              'PATCH',
              JSON.stringify({
                productId:
                  'product-1',
                quantity: 2,
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(500)

        expect(
          consoleError,
        ).toHaveBeenCalledWith(
          'Unexpected cart API error:',
          expect.any(Error),
        )

        consoleError.mockRestore()
      },
    )
  })

  describe('DELETE', () => {
    test(
      'devolve 401 quando utilizador não está autenticado ou ativo',
      async () => {
        mocks.requireActiveUserId
          .mockRejectedValue(
            new mocks
              .UnauthorizedUserError(),
          )

        const response =
          await DELETE(
            createRequest(
              'DELETE',
              JSON.stringify({
                productId:
                  'product-1',
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(401)

        expect(
          mocks.removeCartItem,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita JSON inválido',
      async () => {
        const response =
          await DELETE(
            createRequest(
              'DELETE',
              '{',
            ),
          )

        expect(
          response.status,
        ).toBe(400)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'JSON inválido',
        })
      },
    )

    test(
      'rejeita payload demasiado grande',
      async () => {
        await expectPayloadTooLarge(
          'DELETE',
          DELETE,
        )
      },
    )

    test(
      'rejeita corpo que não é objeto',
      async () => {
        const response =
          await DELETE(
            createRequest(
              'DELETE',
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
        })
      },
    )

    test(
      'rejeita produto e variante em falta',
      async () => {
        const response =
          await DELETE(
            createRequest(
              'DELETE',
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
            'Produto ou variante inválido',
        })
      },
    )

    test(
      'remove item do utilizador autenticado',
      async () => {
        mocks.removeCartItem
          .mockResolvedValue(
            undefined,
          )

        const response =
          await DELETE(
            createRequest(
              'DELETE',
              JSON.stringify({
                productId:
                  'product-1',
              }),
    ),
    )

        expect(
          response.status,
        ).toBe(204)

        expect(
          mocks.removeCartItem,
        ).toHaveBeenCalledWith(
          'user-1',
          'product-1',
        )

        expect(
          await response.text(),
        ).toBe('')
      },
    )

    test(
      'remove item por productVariantId sem exigir productId',
      async () => {
        mocks.removeCartItem.mockResolvedValue(
          undefined,
        )

        const response = await DELETE(
          createRequest(
            'DELETE',
            JSON.stringify({
              productVariantId:
                'variant-1',
            }),
          ),
        )

        expect(response.status).toBe(204)
        expect(
          mocks.removeCartItem,
        ).toHaveBeenCalledWith(
          'user-1',
          {
            productVariantId:
              'variant-1',
          },
        )
      },
    )

    test(
      'devolve 400 para erro de validação',
      async () => {
        mocks.removeCartItem
          .mockRejectedValue(
            new mocks
              .CartValidationError(
                'Produto inválido',
              ),
          )

        const response =
          await DELETE(
            createRequest(
              'DELETE',
              JSON.stringify({
                productId:
                  '   ',
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(400)
      },
    )

    test(
      'devolve 404 quando item não existe',
      async () => {
        mocks.removeCartItem
          .mockRejectedValue(
            new mocks
              .CartItemNotFoundError(),
          )

        const response =
          await DELETE(
            createRequest(
              'DELETE',
              JSON.stringify({
                productId:
                  'product-1',
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
            'Item do carrinho não encontrado',
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

        mocks.removeCartItem
          .mockRejectedValue(
            new Error(
              'Erro inesperado',
            ),
          )

        const response =
          await DELETE(
            createRequest(
              'DELETE',
              JSON.stringify({
                productId:
                  'product-1',
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(500)

        expect(
          consoleError,
        ).toHaveBeenCalledWith(
          'Unexpected cart API error:',
          expect.any(Error),
        )

        consoleError.mockRestore()
      },
    )
  })
})