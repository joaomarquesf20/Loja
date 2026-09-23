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
  resolveGuestCartItems,
  type GuestCartClient,
} from './guest-cart'

function createClient() {
  const variantFindMany = vi.fn()
  const productFindMany = vi.fn()

  const client = {
    productVariant: {
      findMany:
        variantFindMany,
    },
    product: {
      findMany:
        productFindMany,
    },
  } as unknown as GuestCartClient

  return {
    client,
    variantFindMany,
    productFindMany,
  }
}

function defaultVariant() {
  return {
    id: 'variant-1',
    productId: 'product-1',
    sku: 'VAR-001',
    optionKey: 'default',
    price: '249.50',
    stockQuantity: 3,
    isActive: true,
    images: [],
    product: {
      id: 'product-1',
      name: 'Produto',
      slug: 'produto',
      isActive: true,
      images: [
        '/product.jpg',
      ],
    },
  }
}

describe('variant-aware guest cart', () => {
  test('resolve item legado por productId para a variante default', async () => {
    const {
      client,
      variantFindMany,
      productFindMany,
    } = createClient()

    variantFindMany.mockResolvedValue([
      defaultVariant(),
    ])

    const items =
      await resolveGuestCartItems(
        [
          {
            productId:
              'product-1',
            quantity: 2,
          },
        ],
        client,
      )

    expect(
      variantFindMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            {
              productId: {
                in: [
                  'product-1',
                ],
              },
              optionKey:
                'default',
            },
          ],
        },
      }),
    )

    expect(
      productFindMany,
    ).not.toHaveBeenCalled()

    expect(items).toEqual([
      {
        productId: 'product-1',
        productVariantId:
          'variant-1',
        quantity: 2,
        product: {
          id: 'product-1',
          name: 'Produto',
          slug: 'produto',
          price: 249.5,
          images: [
            '/product.jpg',
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

  test('agrupa item legado e variante default e avalia o stock total', async () => {
    const { client, variantFindMany } = createClient()

    variantFindMany.mockResolvedValue([
      defaultVariant(),
    ])

    const items = await resolveGuestCartItems(
      [
        { productId: 'product-1', quantity: 2 },
        {
          productId: 'product-1',
          productVariantId: 'variant-1',
          quantity: 2,
        },
      ],
      client,
    )

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      productVariantId: 'variant-1',
      quantity: 4,
      inStock: true,
      isAvailable: false,
      canIncrease: false,
    })
  })

  test('mantém a linha indisponível quando a variante explícita não pertence ao produto', async () => {
    const {
      client,
      variantFindMany,
    } = createClient()

    variantFindMany.mockResolvedValue([
      {
        ...defaultVariant(),
        productId:
          'product-2',
        product: {
          ...defaultVariant()
            .product,
          id: 'product-2',
        },
      },
    ])

    const [item] =
      await resolveGuestCartItems(
        [
          {
            productId:
              'product-1',
            productVariantId:
              'variant-1',
            quantity: 1,
          },
        ],
        client,
      )

    expect(item).toMatchObject({
      productId: 'product-1',
      productVariantId:
        'variant-1',
      product: null,
      inStock: false,
      isAvailable: false,
    })
  })
})
