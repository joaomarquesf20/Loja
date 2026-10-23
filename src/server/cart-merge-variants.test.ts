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
  mergeGuestCartIntoUserCart,
  type CartMergeClient,
} from './cart-merge'

function createClient(
  stockQuantity = 5,
) {
  const variantFindMany = vi
    .fn()
    .mockResolvedValue([
      {
        id: 'variant-1',
        productId:
          'product-1',
        optionKey:
          'default',
        stockQuantity,
        isActive: true,
        product: {
          id: 'product-1',
          isActive: true,
        },
      },
    ])

  const cartFindMany = vi
    .fn()
    .mockResolvedValue([])

  const cartCreate = vi
    .fn()
    .mockResolvedValue({
      id: 'cart-1',
    })

  const tx = {
    user: {
      findFirst: vi
        .fn()
        .mockResolvedValue({
          id: 'user-1',
        }),
    },
    productVariant: {
      findMany:
        variantFindMany,
    },
    product: {
      findMany: vi.fn(),
    },
    cartItem: {
      findMany:
        cartFindMany,
      update: vi.fn(),
      create:
        cartCreate,
    },
    guestCartMerge: {
      createMany: vi
        .fn()
        .mockResolvedValue({
          count: 1,
        }),
      findUnique: vi.fn(),
    },
  }

  const transaction = vi.fn(
    async (
      callback: (
        transactionClient:
          typeof tx,
      ) => Promise<unknown>,
    ) => callback(tx),
  )

  const client = {
    $transaction:
      transaction,
  } as unknown as CartMergeClient

  return {
    client,
    tx,
    variantFindMany,
    cartFindMany,
    cartCreate,
  }
}

describe('variant-aware cart merge', () => {
  test('converte carrinho guest legado para a variante default no carrinho autenticado', async () => {
    const {
      client,
      tx,
      cartCreate,
    } = createClient()

    const result =
      await mergeGuestCartIntoUserCart(
        'user-1',
        'merge-1',
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
      tx.product.findMany,
    ).not.toHaveBeenCalled()

    expect(
      cartCreate,
    ).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        productId:
          'product-1',
        productVariantId:
          'variant-1',
        quantity: 2,
      },
      select: {
        id: true,
      },
    })

    expect(result).toEqual({
      mergedItemCount: 1,
    })
  })

  test('valida stock na variante durante o merge', async () => {
    const {
      client,
      cartCreate,
    } = createClient(1)

    await expect(
      mergeGuestCartIntoUserCart(
        'user-1',
        'merge-2',
        [
          {
            productId:
              'product-1',
            quantity: 2,
          },
        ],
        client,
      ),
    ).rejects.toThrow(
      'Stock insuficiente',
    )

    expect(
      cartCreate,
    ).not.toHaveBeenCalled()
  })
})
