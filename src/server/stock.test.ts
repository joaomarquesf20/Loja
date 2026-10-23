import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import {
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

const variantUpdateMany =
  vi.fn<UpdateManyFn>()

const client = {
  productVariant: {
    updateMany:
      variantUpdateMany,
  },
} satisfies StockClient

describe('stock', () => {
  beforeEach(() => {
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
})
