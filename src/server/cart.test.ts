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
  CartItemNotFoundError,
  CartProductUnavailableError,
  CartVariantSelectionRequiredError,
  CartValidationError,
  listCartItems,
  removeCartItem,
  updateCartItemQuantity,
  type CartClient,
} from './cart'

function createPurchasableVariant(
  overrides?: {
    isActive?: boolean
    stockQuantity?: number
  },
) {
  return {
    id: 'variant-1',
    productId: 'product-1',
    sku: 'VAR-001',
    price: '12.50',
    stockQuantity:
      overrides?.stockQuantity ?? 5,
    isActive:
      overrides?.isActive ?? true,
    images: ['/variant-1.jpg'],
    product: {
      id: 'product-1',
      isActive: true,
    },
  }
}

function createCartItemRecord(
  overrides?: {
    quantity?: number
    stockQuantity?: number
    isActive?: boolean
    productIsActive?: boolean
  },
) {
  return {
    id: 'cart-item-1',
    productId: 'product-1',
    productVariantId:
      'variant-1',
    quantity:
      overrides?.quantity ?? 2,
    product: {
      id: 'product-1',
      name: 'Produto 1',
      slug: 'produto-1',
      isActive:
        overrides?.productIsActive ??
        true,
      images: [
        '/products/produto-1.jpg',
      ],
    },
    variant: {
      id: 'variant-1',
      productId: 'product-1',
      sku: 'VAR-001',
      price: '12.50',
      stockQuantity:
        overrides?.stockQuantity ?? 5,
      isActive:
        overrides?.isActive ?? true,
      images: ['/variant-1.jpg'],
    },
  }
}

const cartItemSelect = {
  id: true,
  productId: true,
  productVariantId: true,
  quantity: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      images: true,
    },
  },
  variant: {
    select: {
      id: true,
      productId: true,
      sku: true,
      price: true,
      stockQuantity: true,
      isActive: true,
      images: true,
    },
  },
}

const variantSelect = {
  id: true,
  productId: true,
  sku: true,
  price: true,
  stockQuantity: true,
  isActive: true,
  images: true,
  product: {
    select: {
      id: true,
      isActive: true,
    },
  },
}

function createClient(): CartClient {
  return {
    productVariant: {
      findFirst: vi.fn(),
    },
    cartItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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
        select: cartItemSelect,
      })
    })

    test('transforma itens para o modelo público do carrinho, com preço e stock da variante', async () => {
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
          productVariantId:
            'variant-1',
          quantity: 2,
          product: {
            id: 'product-1',
            name: 'Produto 1',
            slug: 'produto-1',
            price: 12.5,
            images: [
              '/variant-1.jpg',
            ],
          },
          variant: {
            id: 'variant-1',
            sku: 'VAR-001',
          },
          inStock: true,
          isAvailable: true,
          canIncrease: true,
        },
      ])
    })

    test('usa as imagens do produto quando a variante não tem', async () => {
      const client = createClient()

      vi.mocked(
        client.cartItem.findMany,
      ).mockResolvedValue([
        createCartItemRecord(),
      ])

      const record =
        createCartItemRecord()
      record.variant.images = []

      vi.mocked(
        client.cartItem.findMany,
      ).mockReset()
      vi.mocked(
        client.cartItem.findMany,
      ).mockResolvedValue([record])

      const [item] =
        await listCartItems(
          'user-1',
          client,
        )

      expect(
        item?.product.images,
      ).toEqual([
        '/products/produto-1.jpg',
      ])
    })

    test('marca item como indisponível quando a quantidade excede o stock da variante', async () => {
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

    test('marca variante inativa como indisponível', async () => {
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
        const client =
          createClient()

        await expect(
          addCartItem(
            'user-1',
            {
              productVariantId:
                'variant-1',
            },
            quantity,
            client,
          ),
        ).rejects.toBeInstanceOf(
          CartValidationError,
        )

        expect(
          client.productVariant
            .findFirst,
        ).not.toHaveBeenCalled()
      },
    )

    test('rejeita alvo vazio sem consultar a base de dados', async () => {
      const client = createClient()

      await expect(
        addCartItem(
          'user-1',
          { productId: '   ' },
          1,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartValidationError,
      )

      expect(
        client.productVariant
          .findFirst,
      ).not.toHaveBeenCalled()
    })

    test('rejeita produto sem variante default ou inativo', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
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
        client.productVariant.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          productId: 'product-1',
          optionKey: 'default',
        },
        select: variantSelect,
      })

      expect(
        client.cartItem.findUnique,
      ).not.toHaveBeenCalled()
    })

    test('rejeita combinação de variante inexistente com erro de seleção', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(null)

      await expect(
        addCartItem(
          'user-1',
          {
            productId: 'product-1',
            productVariantId:
              'variant-oms',
          },
          1,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartVariantSelectionRequiredError,
      )

      expect(
        client.cartItem.findUnique,
      ).not.toHaveBeenCalled()
    })

    test('rejeita variante inativa', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(
        createPurchasableVariant({
          isActive: false,
        }),
      )

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
        client.cartItem.findUnique,
      ).not.toHaveBeenCalled()
    })

    test('rejeita variante sem stock', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(
        createPurchasableVariant({
          stockQuantity: 0,
        }),
      )

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

    test('cria novo item quando a variante ainda não está no carrinho', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(
        createPurchasableVariant(),
      )

      vi.mocked(
        client.cartItem.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.cartItem.create,
      ).mockResolvedValue(
        createCartItemRecord({
          stockQuantity: 5,
        }),
      )

      const result =
        await addCartItem(
          ' user-1 ',
          { productId: ' product-1 ' },
          2,
          client,
        )

      expect(
        client.cartItem.create,
      ).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          productId: 'product-1',
          productVariantId:
            'variant-1',
          quantity: 2,
        },
        select: cartItemSelect,
      })

      expect(result).toMatchObject({
        id: 'cart-item-1',
        productId: 'product-1',
        productVariantId:
          'variant-1',
        quantity: 2,
        isAvailable: true,
      })

      expect(
        client.cartItem.update,
      ).not.toHaveBeenCalled()
    })

    test('incrementa quantidade quando a variante já está no carrinho', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(
        createPurchasableVariant({
          stockQuantity: 10,
        }),
      )

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
        select: cartItemSelect,
      })

      expect(result.quantity).toBe(5)

      expect(
        client.cartItem.create,
      ).not.toHaveBeenCalled()
    })

    test('permite quantidade final exatamente igual ao stock da variante', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(
        createPurchasableVariant({
          stockQuantity: 5,
        }),
      )

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

    test('rejeita incremento que ultrapassa o stock da variante', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(
        createPurchasableVariant({
          stockQuantity: 5,
        }),
      )

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

  describe('updateCartItemQuantity', () => {
    test.each([
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])(
      'rejeita quantidade inválida: %s',
      async (quantity) => {
        const client =
          createClient()

        await expect(
          updateCartItemQuantity(
            'user-1',
            'product-1',
            quantity,
            client,
          ),
        ).rejects.toBeInstanceOf(
          CartValidationError,
        )

        expect(
          client.cartItem.findUnique,
        ).not.toHaveBeenCalled()
      },
    )

    test('rejeita item que não pertence ao utilizador ou não existe', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(
        createPurchasableVariant(),
      )

      vi.mocked(
        client.cartItem.findUnique,
      ).mockResolvedValue(null)

      await expect(
        updateCartItemQuantity(
          'user-1',
          'product-1',
          2,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartItemNotFoundError,
      )

      expect(
        client.cartItem.update,
      ).not.toHaveBeenCalled()
    })

    test('procura item pela combinação de utilizador e variante', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(
        createPurchasableVariant(),
      )

      vi.mocked(
        client.cartItem.findUnique,
      ).mockResolvedValue({
        id: 'cart-item-1',
        quantity: 1,
      })

      vi.mocked(
        client.cartItem.update,
      ).mockResolvedValue(
        createCartItemRecord({
          quantity: 2,
          stockQuantity: 5,
        }),
      )

      await updateCartItemQuantity(
        ' user-1 ',
        ' product-1 ',
        2,
        client,
      )

      expect(
        client.cartItem.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          userId_productVariantId: {
            userId: 'user-1',
            productVariantId:
              'variant-1',
          },
        },
        select: {
          id: true,
          quantity: true,
        },
      })
    })

    test('rejeita variante que ficou inativa ou deixou de existir', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(null)

      await expect(
        updateCartItemQuantity(
          'user-1',
          'product-1',
          2,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartProductUnavailableError,
      )

      expect(
        client.cartItem.update,
      ).not.toHaveBeenCalled()
    })

    test('rejeita quantidade superior ao stock atual da variante', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(
        createPurchasableVariant({
          stockQuantity: 3,
        }),
      )

      vi.mocked(
        client.cartItem.findUnique,
      ).mockResolvedValue({
        id: 'cart-item-1',
        quantity: 2,
      })

      await expect(
        updateCartItemQuantity(
          'user-1',
          'product-1',
          4,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartInsufficientStockError,
      )

      expect(
        client.cartItem.update,
      ).not.toHaveBeenCalled()
    })

    test('substitui a quantidade atual pela nova quantidade', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(
        createPurchasableVariant({
          stockQuantity: 10,
        }),
      )

      vi.mocked(
        client.cartItem.findUnique,
      ).mockResolvedValue({
        id: 'cart-item-1',
        quantity: 4,
      })

      vi.mocked(
        client.cartItem.update,
      ).mockResolvedValue(
        createCartItemRecord({
          quantity: 2,
          stockQuantity: 10,
        }),
      )

      const result =
        await updateCartItemQuantity(
          'user-1',
          'product-1',
          2,
          client,
        )

      expect(
        client.cartItem.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'cart-item-1',
        },
        data: {
          quantity: 2,
        },
        select: cartItemSelect,
      })

      expect(result.quantity).toBe(2)
    })

    test('permite definir quantidade exatamente igual ao stock atual', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(
        createPurchasableVariant({
          stockQuantity: 5,
        }),
      )

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
          stockQuantity: 5,
        }),
      )

      const result =
        await updateCartItemQuantity(
          'user-1',
          'product-1',
          5,
          client,
        )

      expect(result).toMatchObject({
        quantity: 5,
        isAvailable: true,
        canIncrease: false,
      })
    })
  })

  describe('removeCartItem', () => {
    test('rejeita utilizador vazio', async () => {
      const client = createClient()

      await expect(
        removeCartItem(
          '   ',
          'product-1',
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartValidationError,
      )

      expect(
        client.cartItem.findUnique,
      ).not.toHaveBeenCalled()
    })

    test('rejeita alvo vazio', async () => {
      const client = createClient()

      await expect(
        removeCartItem(
          'user-1',
          {
            productId: '   ',
            productVariantId: '',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartValidationError,
      )

      expect(
        client.cartItem.findUnique,
      ).not.toHaveBeenCalled()
    })

    test('rejeita item que não pertence ao utilizador ou não existe', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(
        createPurchasableVariant(),
      )

      vi.mocked(
        client.cartItem.findUnique,
      ).mockResolvedValue(null)

      await expect(
        removeCartItem(
          'user-1',
          'product-1',
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartItemNotFoundError,
      )

      expect(
        client.cartItem.delete,
      ).not.toHaveBeenCalled()
    })

    test('procura item pela combinação de utilizador e variante', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(
        createPurchasableVariant(),
      )

      vi.mocked(
        client.cartItem.findUnique,
      ).mockResolvedValue({
        id: 'cart-item-1',
      })

      vi.mocked(
        client.cartItem.delete,
      ).mockResolvedValue({
        id: 'cart-item-1',
      })

      await removeCartItem(
        ' user-1 ',
        ' product-1 ',
        client,
      )

      expect(
        client.cartItem.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          userId_productVariantId: {
            userId: 'user-1',
            productVariantId:
              'variant-1',
          },
        },
        select: {
          id: true,
        },
      })
    })

    test('remove o item encontrado', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(
        createPurchasableVariant(),
      )

      vi.mocked(
        client.cartItem.findUnique,
      ).mockResolvedValue({
        id: 'cart-item-1',
      })

      vi.mocked(
        client.cartItem.delete,
      ).mockResolvedValue({
        id: 'cart-item-1',
      })

      await expect(
        removeCartItem(
          'user-1',
          'product-1',
          client,
        ),
      ).resolves.toBeUndefined()

      expect(
        client.cartItem.delete,
      ).toHaveBeenCalledWith({
        where: {
          id: 'cart-item-1',
        },
        select: {
          id: true,
        },
      })
    })

    test('permite remover item de variante inativa (não exige que esteja comprável)', async () => {
      const client = createClient()

      vi.mocked(
        client.productVariant.findFirst,
      ).mockResolvedValue(
        createPurchasableVariant({
          isActive: false,
        }),
      )

      vi.mocked(
        client.cartItem.findUnique,
      ).mockResolvedValue({
        id: 'cart-item-1',
      })

      vi.mocked(
        client.cartItem.delete,
      ).mockResolvedValue({
        id: 'cart-item-1',
      })

      await expect(
        removeCartItem(
          'user-1',
          'product-1',
          client,
        ),
      ).resolves.toBeUndefined()
    })
  })
})
