import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import {
  decrementStock,
  decrementVariantStock,
  type StockClient,
} from './stock'

type UpdateManyArgs = {
  where: {
    id: string
    stockQuantity: {
      gte: number
    }
  }
  data: {
    stockQuantity: {
      decrement: number
    }
  }
}

type UpdateManyFn = (
  args: UpdateManyArgs,
) => Promise<{
  count: number
}>

const productUpdateMany =
  vi.fn<UpdateManyFn>()

const variantUpdateMany =
  vi.fn<UpdateManyFn>()

const client = {
  product: {
    updateMany:
      productUpdateMany,
  },
  productVariant: {
    updateMany:
      variantUpdateMany,
  },
} satisfies StockClient

describe('stock', () => {
  beforeEach(() => {
    productUpdateMany.mockReset()
    variantUpdateMany.mockReset()
  })

  test.each([
    0,
    -1,
    1.5,
    Number.NaN,
  ])(
    'rejeita quantidade inválida na variante: %s',
    async (quantity) => {
      await expect(
        decrementVariantStock(
          client,
          'variant-1',
          quantity,
        ),
      ).rejects.toThrow(
        'Quantidade inválida',
      )

      expect(
        variantUpdateMany,
      ).not.toHaveBeenCalled()
    },
  )

  test('decrementa stock da variante de forma condicional', async () => {
    variantUpdateMany.mockResolvedValue({
      count: 1,
    })

    await decrementVariantStock(
      client,
      'variant-1',
      2,
    )

    expect(
      variantUpdateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: 'variant-1',
        stockQuantity: {
          gte: 2,
        },
      },
      data: {
        stockQuantity: {
          decrement: 2,
        },
      },
    })

    expect(
      productUpdateMany,
    ).not.toHaveBeenCalled()
  })

  test('rejeita stock insuficiente da variante', async () => {
    variantUpdateMany.mockResolvedValue({
      count: 0,
    })

    await expect(
      decrementVariantStock(
        client,
        'variant-1',
        3,
      ),
    ).rejects.toThrow(
      'Stock insuficiente',
    )
  })

  test('mantém o helper legado de Product durante a transição', async () => {
    productUpdateMany.mockResolvedValue({
      count: 1,
    })

    await decrementStock(
      client,
      'product-1',
      2,
    )

    expect(
      productUpdateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: 'product-1',
        stockQuantity: {
          gte: 2,
        },
      },
      data: {
        stockQuantity: {
          decrement: 2,
        },
      },
    })
  })

  test('falha explicitamente sem delegate de variantes', async () => {
    const legacyClient: StockClient = {
      product: {
        updateMany:
          productUpdateMany,
      },
    }

    await expect(
      decrementVariantStock(
        legacyClient,
        'variant-1',
        1,
      ),
    ).rejects.toThrow(
      'Stock de variantes indisponível',
    )
  })
})
