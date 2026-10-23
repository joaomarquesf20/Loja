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
  GuestCartServerValidationError,
  resolveGuestCartItems,
  type GuestCartClient,
} from './guest-cart'

type VariantFindMany =
  GuestCartClient['productVariant']['findMany']

function createVariantRecord(
  overrides?: {
    isActive?: boolean
    stockQuantity?: number
    images?: string[]
  },
) {
  return {
    id: 'variant-1',
    productId: 'product-1',
    sku: 'VAR-001',
    optionKey: 'default',
    price: '19.99',
    stockQuantity:
      overrides?.stockQuantity ?? 5,
    isActive:
      overrides?.isActive ?? true,
    images:
      overrides?.images ?? [],
    product: {
      id: 'product-1',
      name: 'Produto 1',
      slug: 'produto-1',
      isActive: true,
      images: [
        '/products/produto-1.jpg',
      ],
    },
  }
}

const variantSelect = {
  id: true,
  productId: true,
  sku: true,
  optionKey: true,
  price: true,
  stockQuantity: true,
  isActive: true,
  images: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      images: true,
    },
  },
}

function createClient() {
  const variantFindMany =
    vi.fn<VariantFindMany>()

  return {
    client: {
      productVariant: {
        findMany: variantFindMany,
      },
    } satisfies GuestCartClient,
    variantFindMany,
  }
}

describe('Guest cart server', () => {
  test('carrinho vazio não consulta a base de dados', async () => {
    const { client, variantFindMany } =
      createClient()

    const result =
      await resolveGuestCartItems(
        [],
        client,
      )

    expect(result).toEqual([])

    expect(
      variantFindMany,
    ).not.toHaveBeenCalled()
  })

  test('consulta variantes ativas/default pelos produtos do carrinho', async () => {
    const { client, variantFindMany } =
      createClient()

    variantFindMany.mockResolvedValue([])

    await resolveGuestCartItems(
      [
        {
          productId: ' product-1 ',
          quantity: 2,
        },
        {
          productId: 'product-2',
          quantity: 1,
        },
      ],
      client,
    )

    expect(
      variantFindMany,
    ).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            productId: {
              in: [
                'product-1',
                'product-2',
              ],
            },
            optionKey: 'default',
          },
        ],
      },
      orderBy: [
        {
          product: {
            name: 'asc',
          },
        },
        {
          position: 'asc',
        },
        {
          id: 'asc',
        },
      ],
      select: variantSelect,
    })
  })

  test('devolve dados públicos e disponibilidade atual da variante', async () => {
    const { client, variantFindMany } =
      createClient()

    variantFindMany.mockResolvedValue([
      createVariantRecord(),
    ])

    const result =
      await resolveGuestCartItems(
        [
          {
            productId: 'product-1',
            quantity: 2,
          },
        ],
        client,
      )

    expect(result).toEqual([
      {
        productId: 'product-1',
        productVariantId: 'variant-1',
        quantity: 2,
        product: {
          id: 'product-1',
          name: 'Produto 1',
          slug: 'produto-1',
          price: 19.99,
          images: [
            '/products/produto-1.jpg',
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
    const { client, variantFindMany } =
      createClient()

    variantFindMany.mockResolvedValue([
      createVariantRecord({
        images: [],
      }),
    ])

    const [item] =
      await resolveGuestCartItems(
        [
          {
            productId: 'product-1',
            quantity: 1,
          },
        ],
        client,
      )

    expect(
      item?.product?.images,
    ).toEqual([
      '/products/produto-1.jpg',
    ])
  })

  test('não expõe a quantidade exata de stock', async () => {
    const { client, variantFindMany } =
      createClient()

    variantFindMany.mockResolvedValue([
      createVariantRecord({
        stockQuantity: 37,
      }),
    ])

    const [item] =
      await resolveGuestCartItems(
        [
          {
            productId: 'product-1',
            quantity: 1,
          },
        ],
        client,
      )

    expect(item).not.toHaveProperty(
      'stockQuantity',
    )

    expect(
      item?.product,
    ).not.toHaveProperty(
      'stockQuantity',
    )

    expect(item?.variant).toEqual({
      id: 'variant-1',
      sku: 'VAR-001',
    })
  })

  test('marca quantidade acima do stock da variante como indisponível', async () => {
    const { client, variantFindMany } =
      createClient()

    variantFindMany.mockResolvedValue([
      createVariantRecord({
        stockQuantity: 2,
      }),
    ])

    const [item] =
      await resolveGuestCartItems(
        [
          {
            productId: 'product-1',
            quantity: 3,
          },
        ],
        client,
      )

    expect(item).toMatchObject({
      inStock: true,
      isAvailable: false,
      canIncrease: false,
    })
  })

  test('marca variante inativa como indisponível', async () => {
    const { client, variantFindMany } =
      createClient()

    variantFindMany.mockResolvedValue([
      createVariantRecord({
        isActive: false,
      }),
    ])

    const [item] =
      await resolveGuestCartItems(
        [
          {
            productId: 'product-1',
            quantity: 1,
          },
        ],
        client,
      )

    expect(item).toMatchObject({
      inStock: false,
      isAvailable: false,
      canIncrease: false,
    })
  })

  test('marca variante sem stock como indisponível', async () => {
    const { client, variantFindMany } =
      createClient()

    variantFindMany.mockResolvedValue([
      createVariantRecord({
        stockQuantity: 0,
      }),
    ])

    const [item] =
      await resolveGuestCartItems(
        [
          {
            productId: 'product-1',
            quantity: 1,
          },
        ],
        client,
      )

    expect(item).toMatchObject({
      inStock: false,
      isAvailable: false,
      canIncrease: false,
    })
  })

  test('mantém item removido da base como indisponível', async () => {
    const { client, variantFindMany } =
      createClient()

    variantFindMany.mockResolvedValue([])

    const result =
      await resolveGuestCartItems(
        [
          {
            productId: 'deleted-product',
            quantity: 1,
          },
        ],
        client,
      )

    expect(result).toEqual([
      {
        productId:
          'deleted-product',
        quantity: 1,
        product: null,
        inStock: false,
        isAvailable: false,
        canIncrease: false,
      },
    ])
  })

  test('combina entradas duplicadas do mesmo produto', async () => {
    const { client, variantFindMany } =
      createClient()

    variantFindMany.mockResolvedValue([
      createVariantRecord({
        stockQuantity: 10,
      }),
    ])

    const result =
      await resolveGuestCartItems(
        [
          {
            productId: 'product-1',
            quantity: 2,
          },
          {
            productId: ' product-1 ',
            quantity: 3,
          },
        ],
        client,
      )

    expect(result).toHaveLength(1)

    expect(result[0]).toMatchObject({
      productId: 'product-1',
      quantity: 5,
      isAvailable: true,
    })
  })

  test('rejeita produto vazio sem consultar a base de dados', async () => {
    const { client, variantFindMany } =
      createClient()

    await expect(
      resolveGuestCartItems(
        [
          {
            productId: '   ',
            quantity: 1,
          },
        ],
        client,
      ),
    ).rejects.toBeInstanceOf(
      GuestCartServerValidationError,
    )

    expect(
      variantFindMany,
    ).not.toHaveBeenCalled()
  })

  test('rejeita quantidade inválida', async () => {
    const { client, variantFindMany } =
      createClient()

    await expect(
      resolveGuestCartItems(
        [
          {
            productId: 'product-1',
            quantity: 0,
          },
        ],
        client,
      ),
    ).rejects.toBeInstanceOf(
      GuestCartServerValidationError,
    )

    expect(
      variantFindMany,
    ).not.toHaveBeenCalled()
  })

  test('rejeita mais de 100 entradas', async () => {
    const { client, variantFindMany } =
      createClient()

    const items = Array.from(
      {
        length: 101,
      },
      (_, index) => ({
        productId: `product-${index}`,
        quantity: 1,
      }),
    )

    await expect(
      resolveGuestCartItems(
        items,
        client,
      ),
    ).rejects.toBeInstanceOf(
      GuestCartServerValidationError,
    )

    expect(
      variantFindMany,
    ).not.toHaveBeenCalled()
  })
})
