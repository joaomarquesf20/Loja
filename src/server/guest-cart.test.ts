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

function createClient(): GuestCartClient {
  return {
    product: {
      findMany: vi.fn(),
    },
  }
}

describe('Guest cart server', () => {
  test('carrinho vazio não consulta a base de dados', async () => {
    const client = createClient()

    const result =
      await resolveGuestCartItems(
        [],
        client,
      )

    expect(result).toEqual([])

    expect(
      client.product.findMany,
    ).not.toHaveBeenCalled()
  })

  test('consulta produtos reais pelos ids do carrinho', async () => {
    const client = createClient()

    vi.mocked(
      client.product.findMany,
    ).mockResolvedValue([])

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
      client.product.findMany,
    ).toHaveBeenCalledWith({
      where: {
        id: {
          in: [
            'product-1',
            'product-2',
          ],
        },
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        stockQuantity: true,
        isActive: true,
        images: true,
      },
    })
  })

  test('devolve dados públicos e disponibilidade atual', async () => {
    const client = createClient()

    vi.mocked(
      client.product.findMany,
    ).mockResolvedValue([
      {
        id: 'product-1',
        name: 'Produto 1',
        slug: 'produto-1',
        price: '19.99',
        stockQuantity: 5,
        isActive: true,
        images: [],
      },
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
      },
    ])
  })

  test('não expõe a quantidade exata de stock', async () => {
    const client = createClient()

    vi.mocked(
      client.product.findMany,
    ).mockResolvedValue([
      {
        id: 'product-1',
        name: 'Produto 1',
        slug: 'produto-1',
        price: 10,
        stockQuantity: 37,
        isActive: true,
        images: [],
      },
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
  })

  test('marca quantidade acima do stock como indisponível', async () => {
    const client = createClient()

    vi.mocked(
      client.product.findMany,
    ).mockResolvedValue([
      {
        id: 'product-1',
        name: 'Produto 1',
        slug: 'produto-1',
        price: 10,
        stockQuantity: 2,
        isActive: true,
        images: [],
      },
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

  test('marca produto inativo como indisponível', async () => {
    const client = createClient()

    vi.mocked(
      client.product.findMany,
    ).mockResolvedValue([
      {
        id: 'product-1',
        name: 'Produto 1',
        slug: 'produto-1',
        price: 10,
        stockQuantity: 5,
        isActive: false,
        images: [],
      },
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
    const client = createClient()

    vi.mocked(
      client.product.findMany,
    ).mockResolvedValue([])

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
    const client = createClient()

    vi.mocked(
      client.product.findMany,
    ).mockResolvedValue([
      {
        id: 'product-1',
        name: 'Produto 1',
        slug: 'produto-1',
        price: 10,
        stockQuantity: 10,
        isActive: true,
        images: [],
      },
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
    })
  })

  test('rejeita produto vazio', async () => {
    const client = createClient()

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
      client.product.findMany,
    ).not.toHaveBeenCalled()
  })

  test('rejeita quantidade inválida', async () => {
    const client = createClient()

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
  })

  test('rejeita mais de 100 entradas', async () => {
    const client = createClient()

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
      client.product.findMany,
    ).not.toHaveBeenCalled()
  })
})
