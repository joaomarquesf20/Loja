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
  CartProductUnavailableError,
  type CartClient,
} from './cart'

function createVariantRecord(
  overrides?: {
    stockQuantity?: number
  },
) {
  return {
    id: 'variant-1',
    productId: 'product-1',
    sku: 'VAR-001',
    price: '149.90',
    stockQuantity:
      overrides?.stockQuantity ?? 5,
    isActive: true,
    images: [
      '/variant.jpg',
    ],
    product: {
      id: 'product-1',
      isActive: true,
    },
  }
}

function createCartRecord() {
  return {
    id: 'cart-1',
    productId: 'product-1',
    productVariantId:
      'variant-1',
    quantity: 1,
    product: {
      id: 'product-1',
      name: 'Produto',
      slug: 'produto',
      price: '99.90',
      stockQuantity: 99,
      isActive: true,
      images: [
        '/product.jpg',
      ],
    },
    variant: {
      id: 'variant-1',
      productId: 'product-1',
      sku: 'VAR-001',
      price: '149.90',
      stockQuantity: 5,
      isActive: true,
      images: [
        '/variant.jpg',
      ],
    },
  }
}

function createClient() {
  const variantFindFirst = vi.fn()
  const productFindFirst = vi.fn()
  const findUnique = vi.fn()
  const create = vi.fn()

  const client = {
    productVariant: {
      findFirst:
        variantFindFirst,
    },
    product: {
      findFirst:
        productFindFirst,
    },
    cartItem: {
      findMany: vi.fn(),
      findUnique,
      create,
      update: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as CartClient

  return {
    client,
    variantFindFirst,
    productFindFirst,
    findUnique,
    create,
  }
}

describe('variant-aware cart', () => {
  test('resolve productId legado para a variante default e usa preço/stock/SKU da variante', async () => {
    const {
      client,
      variantFindFirst,
      productFindFirst,
      findUnique,
      create,
    } = createClient()

    variantFindFirst.mockResolvedValue(
      createVariantRecord(),
    )
    findUnique.mockResolvedValue(null)
    create.mockResolvedValue(
      createCartRecord(),
    )

    const item = await addCartItem(
      'user-1',
      'product-1',
      1,
      client,
    )

    expect(
      variantFindFirst,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productId:
            'product-1',
          optionKey:
            'default',
        },
      }),
    )

    expect(
      productFindFirst,
    ).not.toHaveBeenCalled()

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: 'user-1',
          productId:
            'product-1',
          productVariantId:
            'variant-1',
          quantity: 1,
        },
      }),
    )

    expect(item).toMatchObject({
      productId: 'product-1',
      productVariantId:
        'variant-1',
      product: {
        price: 149.9,
        images: [
          '/variant.jpg',
        ],
      },
      variant: {
        id: 'variant-1',
        sku: 'VAR-001',
      },
      inStock: true,
      isAvailable: true,
    })
  })

  test('rejeita uma variante que não pertence ao productId fornecido', async () => {
    const {
      client,
      variantFindFirst,
    } = createClient()

    variantFindFirst.mockResolvedValue({
      ...createVariantRecord(),
      productId: 'product-2',
      product: {
        id: 'product-2',
        isActive: true,
      },
    })

    await expect(
      addCartItem(
        'user-1',
        {
          productId: 'product-1',
          productVariantId:
            'variant-1',
        },
        1,
        client,
      ),
    ).rejects.toBeInstanceOf(
      CartProductUnavailableError,
    )
  })
})
