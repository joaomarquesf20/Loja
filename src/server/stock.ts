type StockUpdateManyArgs = {
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

type StockDelegate = {
  updateMany(
    args: StockUpdateManyArgs,
  ): Promise<{
    count: number
  }>
}

export type StockClient = {
  productVariant: StockDelegate
}

function validateQuantity(
  quantity: number,
) {
  if (
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      'Quantidade inválida',
    )
  }
}

async function decrementFromDelegate(
  delegate: StockDelegate,
  id: string,
  quantity: number,
) {
  validateQuantity(quantity)

  const result =
    await delegate.updateMany({
      where: {
        id,
        stockQuantity: {
          gte: quantity,
        },
      },
      data: {
        stockQuantity: {
          decrement: quantity,
        },
      },
    })

  if (result.count !== 1) {
    throw new Error(
      'Stock insuficiente',
    )
  }
}

/**
 * Decrementa atomicamente o stock da unidade vendável
 * (ProductVariant). A variante é a única fonte de verdade
 * de inventário; o Product já não tem campos de stock.
 */
export async function decrementVariantStock(
  client: StockClient,
  productVariantId: string,
  quantity: number,
): Promise<void> {
  return decrementFromDelegate(
    client.productVariant,
    productVariantId,
    quantity,
  )
}
