import {
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('./db', () => ({
  prisma: {},
}))

import {
  addCartItem,
  CartInsufficientStockError,
  CartProductUnavailableError,
  CartValidationError,
  listCartItems,
  type CartClient,
} from './cart'

function createClient(): CartClient {
  return {
    product: {
      findFirst: vi.fn(),
    },
    cartItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
}

function createCartItemRecord(
  overrides?: {
    quantity?: number
    stockQuantity?: number
    isActive?: boolean
    price?: number | string
  },
) {
  return {
    id: 'cart-item-1',
    productId: 'product-1',
    quantity:
      overrides?.quantity ?? 2,
    product: {
      id: 'product-1',
      name: 'Produto 1',
      slug: 'produto-1',
      price:
        overrides?.price ?? '12.50',
      stockQuantity:
        overrides?.stockQuantity ?? 5,
      isActive:
        overrides?.isActive ?? true,
      images: [
        '/products/produto-1.jpg',
      ],
    },
  }
}

describe('Cart', () => {
  describe('listCartItems', () => {
    test('lista apenas itens do utilizador indicado', async () => {
      const client = createClient()

      vi.mocked(
        client.cartItem.findMany,
      ).mockResolvedValue([])

      await listCartItems(
        ' user-1 ',
        client,
      )

      expect(
        client.cartItem.findMany,
      ).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
        },
        orderBy: {
          id: 'asc',
        },
        select: {
          id: true,
          productId: true,
          quantity: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              stockQuantity: true,
              isActive: true,
              images: true,
            },
          },
        },
      })
    })

    test('transforma itens para o modelo público do carrinho', async () => {
      const client = createClient()

      vi.mocked(
        client.cartItem.findMany,
      ).mockResolvedValue([
        createCartItemRecord(),
      ])

      const result =
        await listCartItems(
          'user-1',
          client,
        )

      expect(result).toEqual([
        {
          id: 'cart-item-1',
          productId: 'product-1',
          quantity: 2,
          product: {
            id: 'product-1',
            name: 'Produto 1',
            slug: 'produto-1',
            price: 12.5,
            images: [
              '/products/produto-1.jpg',
            ],
          },
          inStock: true,
          isAvailable: true,
          canIncrease: true,
        },
      ])
    })

    test('marca item como indisponível quando a quantidade excede o stock atual', async () => {
      const client = createClient()

      vi.mocked(
        client.cartItem.findMany,
      ).mockResolvedValue([
        createCartItemRecord({
          quantity: 4,
          stockQuantity: 3,
        }),
      ])

      const [item] =
        await listCartItems(
          'user-1',
          client,
        )

      expect(item).toMatchObject({
        inStock: true,
        isAvailable: false,
        canIncrease: false,
      })
    })

    test('marca produto inativo como indisponível', async () => {
      const client = createClient()

      vi.mocked(
        client.cartItem.findMany,
      ).mockResolvedValue([
        createCartItemRecord({
          isActive: false,
        }),
      ])

      const [item] =
        await listCartItems(
          'user-1',
          client,
        )

      expect(item).toMatchObject({
        inStock: false,
        isAvailable: false,
        canIncrease: false,
      })
    })

    test('rejeita utilizador vazio sem consultar a base de dados', async () => {
      const client = createClient()

      await expect(
        listCartItems('   ', client),
      ).rejects.toBeInstanceOf(
        CartValidationError,
      )

      expect(
        client.cartItem.findMany,
      ).not.toHaveBeenCalled()
    })
  })

  describe('addCartItem', () => {
    test.each([
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])(
      'rejeita quantidade inválida: %s',
      async (quantity) => {
        const client = createClient()

        await expect(
          addCartItem(
            'user-1',
            'product-1',
            quantity,
            client,
          ),
        ).rejects.toBeInstanceOf(
          CartValidationError,
        )

        expect(
          client.product.findFirst,
        ).not.toHaveBeenCalled()
      },
    )

    test('rejeita produto vazio sem consultar a base de dados', async () => {
      const client = createClient()

      await expect(
        addCartItem(
          'user-1',
          '   ',
          1,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartValidationError,
      )

      expect(
        client.product.findFirst,
      ).not.toHaveBeenCalled()
    })

    test('rejeita produto inexistente ou inativo', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findFirst,
      ).mockResolvedValue(null)

      await expect(
        addCartItem(
          'user-1',
          'product-1',
          1,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartProductUnavailableError,
      )

      expect(
        client.product.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: 'product-1',
          isActive: true,
        },
        select: {
          id: true,
          stockQuantity: true,
        },
      })

      expect(
        client.cartItem.findUnique,
      ).not.toHaveBeenCalled()
    })

    test('rejeita produto sem stock', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findFirst,
      ).mockResolvedValue({
        id: 'product-1',
        stockQuantity: 0,
      })

      await expect(
        addCartItem(
          'user-1',
          'product-1',
          1,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartInsufficientStockError,
      )

      expect(
        client.cartItem.findUnique,
      ).not.toHaveBeenCalled()
    })

    test('cria novo item quando produto ainda não está no carrinho', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findFirst,
      ).mockResolvedValue({
        id: 'product-1',
        stockQuantity: 5,
      })

      vi.mocked(
        client.cartItem.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.cartItem.create,
      ).mockResolvedValue(
        createCartItemRecord({
          quantity: 2,
          stockQuantity: 5,
        }),
      )

      const result =
        await addCartItem(
          ' user-1 ',
          ' product-1 ',
          2,
          client,
        )

      expect(
        client.cartItem.create,
      ).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          productId: 'product-1',
          quantity: 2,
        },
        select: {
          id: true,
          productId: true,
          quantity: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              stockQuantity: true,
              isActive: true,
              images: true,
            },
          },
        },
      })

      expect(result).toMatchObject({
        id: 'cart-item-1',
        productId: 'product-1',
        quantity: 2,
        isAvailable: true,
      })

      expect(
        client.cartItem.update,
      ).not.toHaveBeenCalled()
    })

    test('incrementa quantidade quando produto já está no carrinho', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findFirst,
      ).mockResolvedValue({
        id: 'product-1',
        stockQuantity: 10,
      })

      vi.mocked(
        client.cartItem.findUnique,
      ).mockResolvedValue({
        id: 'cart-item-1',
        quantity: 2,
      })

      vi.mocked(
        client.cartItem.update,
      ).mockResolvedValue(
        createCartItemRecord({
          quantity: 5,
          stockQuantity: 10,
        }),
      )

      const result =
        await addCartItem(
          'user-1',
          'product-1',
          3,
          client,
        )

      expect(
        client.cartItem.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'cart-item-1',
        },
        data: {
          quantity: 5,
        },
        select: {
          id: true,
          productId: true,
          quantity: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              stockQuantity: true,
              isActive: true,
              images: true,
            },
          },
        },
      })

      expect(result.quantity).toBe(5)

      expect(
        client.cartItem.create,
      ).not.toHaveBeenCalled()
    })

    test('permite quantidade final exatamente igual ao stock', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findFirst,
      ).mockResolvedValue({
        id: 'product-1',
        stockQuantity: 5,
      })

      vi.mocked(
        client.cartItem.findUnique,
      ).mockResolvedValue({
        id: 'cart-item-1',
        quantity: 3,
      })

      vi.mocked(
        client.cartItem.update,
      ).mockResolvedValue(
        createCartItemRecord({
          quantity: 5,
          stockQuantity: 5,
        }),
      )

      const result =
        await addCartItem(
          'user-1',
          'product-1',
          2,
          client,
        )

      expect(result).toMatchObject({
        quantity: 5,
        isAvailable: true,
        canIncrease: false,
      })
    })

    test('rejeita incremento que ultrapassa o stock disponível', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findFirst,
      ).mockResolvedValue({
        id: 'product-1',
        stockQuantity: 5,
      })

      vi.mocked(
        client.cartItem.findUnique,
      ).mockResolvedValue({
        id: 'cart-item-1',
        quantity: 4,
      })

      await expect(
        addCartItem(
          'user-1',
          'product-1',
          2,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartInsufficientStockError,
      )

      expect(
        client.cartItem.create,
      ).not.toHaveBeenCalled()

      expect(
        client.cartItem.update,
      ).not.toHaveBeenCalled()
    })
  })
})
